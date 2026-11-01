import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";

/**
 * LEARNING NOTE: this is the real auth check. It validates the session against
 * the database, unlike proxy.ts, which only sees that a cookie exists. Every
 * page, route handler, and Server Action must call it, and must take the user's
 * id from here, never from the request.
 *
 * React's cache() only dedupes calls within one request, so a page can call this
 * from several places with one lookup. It never shares a session across requests.
 */
export const getUser = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});
