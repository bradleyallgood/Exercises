"use server";

import { updateTag } from "next/cache";
import { activitiesTag } from "@/lib/activities";
import { activityStore } from "@/lib/activity-store";
import { activityInputSchema } from "@/lib/schemas";
import { getUser } from "@/lib/session";

// LEARNING NOTE: "use server" turns each export into an RPC endpoint. The client
// calls it like a function, but Next.js sends a POST behind the scenes, so anyone
// can call it with anything. The TypeScript signature protects nothing at runtime:
// check auth, take `unknown`, and validate, exactly as in a route handler.
//
// Pick a Server Action for mutations from your own UI. Pick a route handler when
// something else needs a stable URL: mobile apps, webhooks, third parties, curl.

export async function createActivity(input: unknown): Promise<{ error: string | null }> {
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  const parsed = activityInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Validation failed" };

  await activityStore.create(user.id, parsed.data);
  // updateTag only works in Server Actions: it expires the entry now, so the page
  // that comes back in this response shows the user their own write.
  updateTag(activitiesTag(user.id));
  return { error: null };
}
