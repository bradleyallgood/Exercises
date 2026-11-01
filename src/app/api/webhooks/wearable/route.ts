import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { activitiesTag } from "@/lib/activities";
import { activityStore, wearableConnections } from "@/lib/activity-store";
import { activityInputSchema, type ApiErrorBody, type WebhookResponse } from "@/lib/schemas";
import {
  HANDLED_EVENTS,
  toActivityInput,
  verifySignature,
  WEARABLE_PROVIDER,
  wearableActivitySchema,
  wearableEventSchema,
} from "@/lib/wearable";

// LEARNING NOTE: a webhook is called by a server, so there is no session and
// getUser() does not apply. The signature proves who sent it, and the owner comes
// from wearable_connections. Status codes are also instructions: providers retry
// on failure, so anything a retry cannot fix must not look like a failure. That is
// why an event we ignore gets a 200, and why a 500 is the right answer when our
// database is down: the retry will deliver it later.

function validationFailed(error: z.ZodError) {
  return NextResponse.json<ApiErrorBody>(
    { error: "Validation failed", details: z.flattenError(error) },
    { status: 422 },
  );
}

export async function POST(request: Request) {
  // Fail closed: without a secret, nothing can be verified, so nothing is accepted.
  const secret = process.env.WEARABLE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json<ApiErrorBody>({ error: "Webhook not configured" }, { status: 503 });
  }

  // The signature covers the exact bytes, so read the text before parsing anything.
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-pulse-signature"), secret)) {
    return NextResponse.json<ApiErrorBody>({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json<ApiErrorBody>(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const event = wearableEventSchema.safeParse(body);
  if (!event.success) return validationFailed(event.error);

  if (!HANDLED_EVENTS.includes(event.data.type)) {
    return NextResponse.json<WebhookResponse>({ status: "ignored" });
  }

  const activity = wearableActivitySchema.safeParse(event.data.data);
  if (!activity.success) return validationFailed(activity.error);

  const input = activityInputSchema.safeParse(toActivityInput(activity.data));
  if (!input.success) return validationFailed(input.error);

  const userId = await wearableConnections.findUserId(WEARABLE_PROVIDER, activity.data.athlete_id);
  if (!userId) return NextResponse.json<WebhookResponse>({ status: "ignored" });

  const { created } = await activityStore.upsertExternal(
    userId,
    { source: WEARABLE_PROVIDER, externalId: activity.data.activity_id },
    input.data,
  );
  revalidateTag(activitiesTag(userId), { expire: 0 });
  return NextResponse.json<WebhookResponse>({ status: created ? "created" : "updated" });
}
