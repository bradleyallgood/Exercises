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

/** What clients send us. */
export type ActivityInput = z.infer<typeof activityInputSchema>;

/** What clients send to change an activity: any subset of the input. */
export type ActivityPatch = z.infer<typeof activityPatchSchema>;

/** What we store and return: the input plus server-generated fields. */
export type Activity = ActivityInput & {
  id: string;
  createdAt: string;
};

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
