import { describe, expect, it } from "vitest";
import { activityInputSchema, activityPatchSchema, activitySchema } from "./schemas";

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

describe("activitySchema", () => {
  const stored = {
    ...valid,
    id: "9b2f6c1e-3d4a-4e8b-9f10-2a7c5d6e8f01",
    createdAt: "2026-10-31T12:00:01.000Z",
  };

  it("accepts a stored activity", () => {
    expect(activitySchema.safeParse(stored).success).toBe(true);
  });

  it("requires the server-generated fields", () => {
    expect(activitySchema.safeParse(valid).success).toBe(false);
  });

  it("rejects a malformed id", () => {
    expect(activitySchema.safeParse({ ...stored, id: "abc" }).success).toBe(false);
  });
});

describe("activityPatchSchema", () => {
  it("accepts a subset of fields", () => {
    expect(activityPatchSchema.safeParse({ durationMinutes: 45 }).success).toBe(true);
  });

  it("still validates the fields it is given", () => {
    expect(activityPatchSchema.safeParse({ durationMinutes: -5 }).success).toBe(false);
  });

  it("rejects an empty patch", () => {
    expect(activityPatchSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a patch with only unknown fields", () => {
    expect(activityPatchSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});
