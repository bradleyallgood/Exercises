import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Activity, ActivityInput, ActivityPatch } from "./schemas";

/**
 * LEARNING NOTE: the rest of the app depends on this interface, not on how
 * data is stored. Every method takes the owner's id, so a query that forgets to
 * scope by user is a compile error rather than a data leak. The app runs on
 * Postgres (activity-store.ts); the JSON-file version below backs the tests.
 */
export interface ActivityStore {
  list(userId: string): Promise<Activity[]>;
  create(userId: string, input: ActivityInput): Promise<Activity>;
  /** Returns the updated activity, or null if this user has no such id. */
  update(userId: string, id: string, patch: ActivityPatch): Promise<Activity | null>;
  /** Returns false if this user has no such id. */
  delete(userId: string, id: string): Promise<boolean>;
  /** Creates the imported activity, or updates it if this ref was seen before. */
  upsertExternal(
    userId: string,
    ref: ExternalRef,
    input: ActivityInput,
  ): Promise<{ activity: Activity; created: boolean }>;
}

/** Where an imported activity came from, and its id there. */
export type ExternalRef = { source: string; externalId: string };

type StoredActivity = Activity & { userId: string } & Partial<ExternalRef>;

function toActivity(stored: StoredActivity): Activity {
  return {
    id: stored.id,
    type: stored.type,
    durationMinutes: stored.durationMinutes,
    distanceKm: stored.distanceKm,
    performedAt: stored.performedAt,
    createdAt: stored.createdAt,
  };
}

export function createFileActivityStore(filePath: string): ActivityStore {
  async function readAll(): Promise<StoredActivity[]> {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as StoredActivity[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async function writeAll(all: StoredActivity[]): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(all, null, 2), "utf8");
  }

  return {
    async list(userId) {
      const all = await readAll();
      // Newest activity first.
      return all
        .filter((a) => a.userId === userId)
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
        .map(toActivity);
    },

    async create(userId, input) {
      const all = await readAll();
      const activity: StoredActivity = {
        ...input,
        userId,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      all.push(activity);
      await writeAll(all);
      return toActivity(activity);
    },

    async update(userId, id, patch) {
      const all = await readAll();
      const existing = all.find((a) => a.id === id && a.userId === userId);
      if (!existing) return null;
      const updated: StoredActivity = { ...existing, ...patch };
      await writeAll(all.map((a) => (a === existing ? updated : a)));
      return toActivity(updated);
    },

    async delete(userId, id) {
      const all = await readAll();
      const remaining = all.filter((a) => !(a.id === id && a.userId === userId));
      if (remaining.length === all.length) return false;
      await writeAll(remaining);
      return true;
    },

    async upsertExternal(userId, { source, externalId }, input) {
      const all = await readAll();
      const existing = all.find(
        (a) => a.userId === userId && a.source === source && a.externalId === externalId,
      );
      const stored: StoredActivity = {
        ...input,
        userId,
        source,
        externalId,
        id: existing?.id ?? randomUUID(),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await writeAll(
        existing ? all.map((a) => (a === existing ? stored : a)) : [...all, stored],
      );
      return { activity: toActivity(stored), created: !existing };
    },
  };
}
