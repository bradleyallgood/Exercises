import { describe, expect, it } from "vitest";
import { activityInputSchema } from "./schemas";
import {
  signPayload,
  toActivityInput,
  verifySignature,
  wearableActivitySchema,
  type WearableActivity,
} from "./wearable";

const activity: WearableActivity = {
  activity_id: "act_1",
  athlete_id: "ath_1",
  sport_type: "running",
  start_date: "2026-10-31T08:00:00-06:00",
  elapsed_seconds: 1834,
  distance_meters: 5210,
};

describe("toActivityInput", () => {
  it("converts units, type, and timezone", () => {
    expect(toActivityInput(activity)).toEqual({
      type: "run",
      durationMinutes: 31,
      distanceKm: 5.21,
      performedAt: "2026-10-31T14:00:00.000Z",
    });
  });

  it("maps sports case-insensitively and falls back to workout", () => {
    expect(toActivityInput({ ...activity, sport_type: "Cycling" }).type).toBe("bike");
    expect(toActivityInput({ ...activity, sport_type: "yoga" }).type).toBe("workout");
  });

  it("rounds very short activities up to a valid duration", () => {
    expect(toActivityInput({ ...activity, elapsed_seconds: 12 }).durationMinutes).toBe(1);
  });

  it("omits distance when the provider has none", () => {
    expect(toActivityInput({ ...activity, distance_meters: null })).not.toHaveProperty("distanceKm");
    expect(toActivityInput({ ...activity, distance_meters: 0 })).not.toHaveProperty("distanceKm");
  });

  it("can produce input the app rejects, which is why it is validated again", () => {
    const tooLong = toActivityInput({ ...activity, elapsed_seconds: 30 * 3600 });
    expect(activityInputSchema.safeParse(tooLong).success).toBe(false);
  });
});

describe("wearableActivitySchema", () => {
  it("accepts offsets and ignores fields it does not know", () => {
    expect(wearableActivitySchema.safeParse({ ...activity, heart_rate: 150 }).success).toBe(true);
  });

  it("rejects a missing field or wrong type", () => {
    expect(wearableActivitySchema.safeParse({ ...activity, athlete_id: undefined }).success).toBe(false);
    expect(wearableActivitySchema.safeParse({ ...activity, elapsed_seconds: "1834" }).success).toBe(false);
  });
});

describe("verifySignature", () => {
  const body = '{"id":"evt_1"}';
  const secret = "test-secret";
  const now = 1_800_000_000;

  it("accepts a correct signature", () => {
    expect(verifySignature(body, signPayload(body, secret, now), secret, now)).toBe(true);
  });

  it("rejects a changed body", () => {
    expect(verifySignature(`${body} `, signPayload(body, secret, now), secret, now)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    expect(verifySignature(body, signPayload(body, "other", now), secret, now)).toBe(false);
  });

  it("rejects an old timestamp, so captured requests cannot be replayed", () => {
    expect(verifySignature(body, signPayload(body, secret, now - 301), secret, now)).toBe(false);
  });

  it("rejects a timestamp swapped into a valid signature", () => {
    const [, digest] = signPayload(body, secret, now - 3600).split(",");
    expect(verifySignature(body, `t=${now},${digest}`, secret, now)).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(verifySignature(body, null, secret, now)).toBe(false);
    expect(verifySignature(body, "nonsense", secret, now)).toBe(false);
    expect(verifySignature(body, `t=${now},v1=abc`, secret, now)).toBe(false);
  });
});
