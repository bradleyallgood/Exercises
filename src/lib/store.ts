import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Activity, ActivityInput, ActivityPatch } from "./schemas";
import { createPostgresActivityStore } from "./postgres-store";


/**
 * LEARNING NOTE: the rest of the app depends on this interface, not on how
 * data is stored. The JSON-file version below keeps the starter runnable with
 * zero setup. Your first big exercise (see README) is writing a second
 * implementation backed by Postgres + Prisma or Drizzle, then swapping it in
 * without touching the API route or the pages.
 */
export interface ActivityStore {
  list(): Promise<Activity[]>;
  create(input: ActivityInput): Promise<Activity>;
  /** Returns the updated activity, or null if the id is unknown. */
  update(id: string, patch: ActivityPatch): Promise<Activity | null>;
  /** Returns false if the id is unknown. */
  delete(id: string): Promise<boolean>;
}

export function createFileActivityStore(filePath: string): ActivityStore {
  async function readAll(): Promise<Activity[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as Activity[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeAll(all: Activity[]): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(all, null, 2), "utf8");
  }

  return {
    async list() {
      const all = await readAll();
      // Newest activity first.
      return [...all].sort((a, b) => b.performedAt.localeCompare(a.performedAt));
    },

    async create(input) {
      const all = await readAll();
      const activity: Activity = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      all.push(activity);
      await writeAll(all);
      return activity;
    },

    async update(id, patch) {
      const all = await readAll();
      const existing = all.find((a) => a.id === id);
      if (!existing) return null;
      const updated: Activity = { ...existing, ...patch };
      await writeAll(all.map((a) => (a.id === id ? updated : a)));
      return updated;
    },

    async delete(id) {
      const all = await readAll();
      const remaining = all.filter((a) => a.id !== id);
      if (remaining.length === all.length) return false;
      await writeAll(remaining);
      return true;
    },
  };
}

/** Shared instance used by the app. Postgres when configured, otherwise .data/. */
export const activityStore: ActivityStore = process.env.DATABASE_URL
  ? createPostgresActivityStore(process.env.DATABASE_URL)
  : createFileActivityStore(path.join(process.cwd(), ".data", "activities.json"));

