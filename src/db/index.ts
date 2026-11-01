import { drizzle } from "drizzle-orm/node-postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required. See the README.");

/** One shared connection pool for the auth tables and the activity store. */
export const db = drizzle(url);
