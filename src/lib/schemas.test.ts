import { describe, expect, it } from "vitest";
import { activityInputSchema } from "./schemas";

const valid = {
  type: "run",
  durationMinutes: 30,
  distanceKm: 5.2,
  performedAt: "2026-10-31T12:00:00.000Z",
};

describe("activityInputSchema", () => {
  it("accepts a valid activity", () => {
    expect(activityInputSchema.safeParse(valid).success).toBe(true);
  });

  it("allows distance to be omitted", () => {
    const { distanceKm: _omit, ...rest } = valid;
    expect(activityInputSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects an unknown activity type", () => {
    expect(activityInputSchema.safeParse({ ...valid, type: "teleport" }).success).toBe(false);
  });

  it("rejects non-positive or fractional durations", () => {
    expect(activityInputSchema.safeParse({ ...valid, durationMinutes: 0 }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...valid, durationMinutes: 12.5 }).success).toBe(false);
  });

  it("rejects negative distance", () => {
    expect(activityInputSchema.safeParse({ ...valid, distanceKm: -1 }).success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(activityInputSchema.safeParse({ ...valid, performedAt: "yesterday" }).success).toBe(
      false,
    );
  });
});
