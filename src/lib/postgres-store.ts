import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { activities } from "../db/schema";
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

export function createPostgresActivityStore(connectionString: string): ActivityStore {
  const db = drizzle(connectionString);

  return {
    async list() {
      const rows = await db.select().from(activities).orderBy(desc(activities.performedAt));
      return rows.map(toActivity);
    },

    async create(input) {
      const [row] = await db
        .insert(activities)
        .values({ ...input, performedAt: new Date(input.performedAt) })
        .returning();
      if (!row) throw new Error("Insert returned no row");
      return toActivity(row);
    },
  };
}
