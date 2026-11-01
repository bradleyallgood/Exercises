import type { Activity, ActivityType } from "./schemas";

export interface ActivitySummary {
  count: number;
  totalMinutes: number;
  totalDistanceKm: number;
  minutesByType: Partial<Record<ActivityType, number>>;
}

/** Pure function: easy to unit test, no I/O. */
export function summarize(activities: Activity[]): ActivitySummary {
  const summary: ActivitySummary = {
    count: activities.length,
    totalMinutes: 0,
    totalDistanceKm: 0,
    minutesByType: {},
  };

  for (const a of activities) {
    summary.totalMinutes += a.durationMinutes;
    summary.totalDistanceKm += a.distanceKm ?? 0;
    summary.minutesByType[a.type] = (summary.minutesByType[a.type] ?? 0) + a.durationMinutes;
  }

  // Avoid floating-point noise like 5.300000000000001.
  summary.totalDistanceKm = Math.round(summary.totalDistanceKm * 100) / 100;
  return summary;
}
