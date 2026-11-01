import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ActivityInput, ActivityType } from "./schemas";

/**
 * LEARNING NOTE: everything specific to the wearable provider lives here, an
 * "anti-corruption layer". The provider's field names and units stop at this file,
 * and the rest of the app only ever sees ActivityInput. Supporting a second
 * provider means a second mapper, not changes throughout the app.
 *
 * The provider is mocked. Its payload shape imitates real ones: snake_case fields,
 * seconds, meters, and timestamps with a UTC offset.
 */
export const WEARABLE_PROVIDER = "pulse";

/** Events this app acts on. Anything else is acknowledged and ignored. */
export const HANDLED_EVENTS = ["activity.created", "activity.updated"];

// Providers add new event types without warning, so `data` stays unknown here and
// is only validated once we know the event is one we handle.
export const wearableEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.unknown(),
});

export const wearableActivitySchema = z.object({
  activity_id: z.string().min(1),
  athlete_id: z.string().min(1),
  sport_type: z.string().min(1),
  start_date: z.iso.datetime({ offset: true }),
  elapsed_seconds: z.number().positive(),
  distance_meters: z.number().nonnegative().nullish(),
});

export type WearableActivity = z.infer<typeof wearableActivitySchema>;

const SPORT_TYPES: Record<string, ActivityType> = {
  running: "run",
  trail_running: "run",
  walking: "walk",
  hiking: "walk",
  cycling: "bike",
  swimming: "swim",
};

/**
 * The result still has to pass activityInputSchema: a valid provider payload can
 * map to something this app does not accept, like a 30-hour activity.
 */
export function toActivityInput(activity: WearableActivity): ActivityInput {
  const { sport_type, start_date, elapsed_seconds, distance_meters } = activity;

  return {
    type: SPORT_TYPES[sport_type.toLowerCase()] ?? "workout",
    durationMinutes: Math.max(1, Math.round(elapsed_seconds / 60)),
    ...(distance_meters ? { distanceKm: Math.round(distance_meters / 10) / 100 } : {}),
    performedAt: new Date(start_date).toISOString(),
  };
}

/** Old enough to be a replayed request rather than a slow delivery. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export function signPayload(rawBody: string, secret: string, timestamp: number): string {
  const digest = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

/**
 * LEARNING NOTE: this signs the raw bytes, not parsed JSON, because re-serializing
 * can change them. The timestamp is inside the signature, so it cannot be altered
 * to replay an old request. timingSafeEqual stops an attacker learning the digest
 * byte by byte from how long a comparison takes.
 */
export function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Date.now() / 1000,
): boolean {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!match) return false;

  const timestamp = Number(match[1]);
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = signPayload(rawBody, secret, timestamp);
  return timingSafeEqual(Buffer.from(header ?? ""), Buffer.from(expected));
}
