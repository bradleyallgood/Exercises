import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * LEARNING NOTE: this is the real auth check. It validates the session against
 * the database, unlike proxy.ts, which only sees that a cookie exists. Every
 * page, route handler, and Server Action must call it, and must take the user's
 * id from here, never from the request.
 */
export async function getUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
