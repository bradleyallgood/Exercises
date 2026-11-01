import { z } from "zod";

/**
 * LEARNING NOTE: one Zod schema gives you BOTH runtime validation and a
 * compile-time TypeScript type (via z.infer). TypeScript types vanish at
 * runtime, so anything crossing a trust boundary (HTTP bodies, env vars,
 * third-party API responses like a wearable provider) must be validated.
 */

export const ACTIVITY_TYPES = ["run", "walk", "bike", "swim", "workout"] as const;

export const activityInputSchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  durationMinutes: z.number().int().positive().max(24 * 60),
  distanceKm: z.number().nonnegative().max(1000).optional(),
  performedAt: z.iso.datetime(),
});

export const activityPatchSchema = activityInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Provide at least one field to update");

export const activitySchema = activityInputSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
});

// The API's response bodies. Route handlers are typed against these at compile
// time, and the typed client validates them at runtime (see api-client.ts).
export const activityResponseSchema = z.object({ data: activitySchema });
export const activityListResponseSchema = z.object({ data: z.array(activitySchema) });
export const apiErrorSchema = z.object({
  error: z.string(),
  details: z
    .object({
      formErrors: z.array(z.string()),
      fieldErrors: z.record(z.string(), z.array(z.string())),
    })
    .optional(),
});

/** What clients send us. */
export type ActivityInput = z.infer<typeof activityInputSchema>;

/** What clients send to change an activity: any subset of the input. */
export type ActivityPatch = z.infer<typeof activityPatchSchema>;

/** What we store and return: the input plus server-generated fields. */
export type Activity = z.infer<typeof activitySchema>;

export type ActivityResponse = z.infer<typeof activityResponseSchema>;
export type ActivityListResponse = z.infer<typeof activityListResponseSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
