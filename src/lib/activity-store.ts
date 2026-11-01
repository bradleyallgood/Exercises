import { db } from "../db";
import { createPostgresActivityStore } from "./postgres-store";

/** Shared instance used by the app. */
export const activityStore = createPostgresActivityStore(db);
