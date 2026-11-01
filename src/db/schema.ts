import { doublePrecision, integer, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { ACTIVITY_TYPES } from "../lib/schemas";

export const activityType = pgEnum("activity_type", ACTIVITY_TYPES);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: activityType("type").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  distanceKm: doublePrecision("distance_km"),
  performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
