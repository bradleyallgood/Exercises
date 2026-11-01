import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { activityStore } from "./activity-store";
import type { Activity } from "./schemas";
import { getUser } from "./session";

/**
 * LEARNING NOTE: what is cached here is one user's activity list, on the server.
 * The session check is deliberately NOT cached: getActivities() runs it on every
 * request, then hands only the id to the cached function.
 *
 * userId is a function argument, so it is part of the cache key: each user gets
 * their own entry. listForUser stays unexported so no caller can pass someone
 * else's id. `use cache` cannot read cookies() or headers() anyway.
 *
 * Every write must invalidate this tag or the dashboard goes stale. cacheLife
 * bounds how stale it can get if a write ever misses, such as a change made
 * directly in the database or on another server instance (the default cache is
 * in-memory, per instance).
 */
export function activitiesTag(userId: string) {
  return `activities:${userId}`;
}

async function listForUser(userId: string): Promise<Activity[]> {
  "use cache";
  cacheTag(activitiesTag(userId));
  cacheLife("minutes");
  return activityStore.list(userId);
}

export async function getActivities(): Promise<Activity[]> {
  const user = await getUser();
  if (!user) redirect("/login");
  return listForUser(user.id);
}
