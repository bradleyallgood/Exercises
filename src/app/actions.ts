"use server";

import { revalidatePath } from "next/cache";
import { activityInputSchema } from "@/lib/schemas";
import { activityStore } from "@/lib/store";

// LEARNING NOTE: "use server" turns each export into an RPC endpoint. The client
// calls it like a function, but Next.js sends a POST behind the scenes, so anyone
// can call it with anything. The TypeScript signature protects nothing at runtime:
// take `unknown` and validate, exactly as in a route handler.
//
// Pick a Server Action for mutations from your own UI. Pick a route handler when
// something else needs a stable URL: mobile apps, webhooks, third parties, curl.

export async function createActivity(input: unknown): Promise<{ error: string | null }> {
  const parsed = activityInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Validation failed" };

  await activityStore.create(parsed.data);
  // Replaces router.refresh(): the fresh page comes back in the action's response.
  revalidatePath("/");
  return { error: null };
}
