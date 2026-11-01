import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { activities, wearableConnections } from "../db/schema";
import type { Activity } from "./schemas";
import type { ActivityStore } from "./store";

function toActivity(row: typeof activities.$inferSelect): Activity {
  return {
    id: row.id,
    type: row.type,
    durationMinutes: row.durationMinutes,
    distanceKm: row.distanceKm ?? undefined,
    performedAt: row.performedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function createPostgresActivityStore(db: NodePgDatabase): ActivityStore {
  return {
    async list(userId) {
      const rows = await db
        .select()
        .from(activities)
        .where(eq(activities.userId, userId))
        .orderBy(desc(activities.performedAt));
      return rows.map(toActivity);
    },

    async create(userId, input) {
      const [row] = await db
        .insert(activities)
        .values({ ...input, userId, performedAt: new Date(input.performedAt) })
        .returning();
      if (!row) throw new Error("Insert returned no row");
      return toActivity(row);
    },

    async update(userId, id, patch) {
      const { performedAt, ...rest } = patch;
      const [row] = await db
        .update(activities)
        .set({ ...rest, ...(performedAt ? { performedAt: new Date(performedAt) } : {}) })
        .where(and(eq(activities.id, id), eq(activities.userId, userId)))
        .returning();
      return row ? toActivity(row) : null;
    },

    async delete(userId, id) {
      const rows = await db
        .delete(activities)
        .where(and(eq(activities.id, id), eq(activities.userId, userId)))
        .returning({ id: activities.id });
      return rows.length > 0;
    },

    async upsertExternal(userId, { source, externalId }, input) {
      const performedAt = new Date(input.performedAt);
      const [row] = await db
        .insert(activities)
        .values({ ...input, userId, source, externalId, performedAt })
        .onConflictDoUpdate({
          target: [activities.userId, activities.source, activities.externalId],
          // distanceKm is explicit so an update can clear it. createdAt stays.
          set: { ...input, performedAt, distanceKm: input.distanceKm ?? null },
        })
        // xmax is 0 on a freshly inserted row and set on one that was updated.
        .returning({ ...getTableColumns(activities), created: sql<boolean>`(xmax = 0)` });
      if (!row) throw new Error("Upsert returned no row");
      return { activity: toActivity(row), created: row.created };
    },
  };
}

export function createPostgresWearableConnections(db: NodePgDatabase) {
  return {
    async findUserId(provider: string, athleteId: string): Promise<string | null> {
      const [row] = await db
        .select({ userId: wearableConnections.userId })
        .from(wearableConnections)
        .where(
          and(
            eq(wearableConnections.provider, provider),
            eq(wearableConnections.athleteId, athleteId),
          ),
        );
      return row?.userId ?? null;
    },
  };
}
