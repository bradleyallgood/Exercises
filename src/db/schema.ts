import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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
    // Set only on imported activities. NULLs never conflict in a unique index, so
    // activities logged by hand are unaffected.
    source: text("source"),
    externalId: text("external_id"),
  },
  (table) => [
    index("activities_user_id_idx").on(table.userId),
    uniqueIndex("activities_external_idx").on(table.userId, table.source, table.externalId),
  ],
);

/** Links an athlete at a wearable provider to a user here. */
export const wearableConnections = pgTable(
  "wearable_connections",
  {
    provider: text("provider").notNull(),
    athleteId: text("athlete_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.provider, table.athleteId] })],
);
