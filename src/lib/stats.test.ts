import { describe, expect, it } from "vitest";
import type { Activity } from "./schemas";
import { summarize } from "./stats";

function make(partial: Partial<Activity>): Activity {
  return {
    id: "id",
    createdAt: "2026-10-31T00:00:00.000Z",
    type: "run",
    durationMinutes: 10,
    performedAt: "2026-10-31T00:00:00.000Z",
    ...partial,
  };
}

describe("summarize", () => {
  it("returns zeros for an empty list", () => {
    expect(summarize([])).toEqual({
      count: 0,
      totalMinutes: 0,
      totalDistanceKm: 0,
      minutesByType: {},
    });
  });

  it("totals minutes, distance, and per-type minutes", () => {
    const result = summarize([
      make({ type: "run", durationMinutes: 30, distanceKm: 5.1 }),
      make({ type: "run", durationMinutes: 20, distanceKm: 3.2 }),
      make({ type: "swim", durationMinutes: 45 }),
    ]);

    expect(result.count).toBe(3);
    expect(result.totalMinutes).toBe(95);
    expect(result.totalDistanceKm).toBe(8.3);
    expect(result.minutesByType).toEqual({ run: 50, swim: 45 });
  });
});
