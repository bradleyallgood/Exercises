import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { ACTIVITY_TYPES } from "../lib/schemas";
import { user } from "./auth-schema";

export const activityType = pgEnum("activity_type", ACTIVITY_TYPES);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: activityType("type").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    distanceKm: doublePrecision("distance_km"),
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activities_user_id_idx").on(table.userId)],
);
