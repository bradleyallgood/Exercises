import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Activity, ActivityInput } from "./schemas";
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
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(all, null, 2), "utf8");
      return activity;
    },
  };
}

/** Shared instance used by the app. Postgres when configured, otherwise .data/. */
export const activityStore: ActivityStore = process.env.DATABASE_URL
  ? createPostgresActivityStore(process.env.DATABASE_URL)
  : createFileActivityStore(path.join(process.cwd(), ".data", "activities.json"));

