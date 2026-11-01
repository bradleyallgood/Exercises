import { db } from "../db";
import { createPostgresActivityStore, createPostgresWearableConnections } from "./postgres-store";

/** Shared instances used by the app. */
export const activityStore = createPostgresActivityStore(db);
export const wearableConnections = createPostgresWearableConnections(db);
