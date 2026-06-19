import { getWeekStartDate } from "@/domain/plan";

export type WeeklyVolumePoint = {
  weekStart: string;
  workouts: number;
  sets: number;
};

export type VolumeEntry = {
  completedAt: string;
  setCount: number;
};

function addWeeks(isoWeekStart: string, weeks: number): string {
  const date = new Date(`${isoWeekStart}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

/**
 * Buckets completed workouts into weekly totals for charting.
 */
export function aggregateWeeklyVolume(
  entries: VolumeEntry[],
  weeks: number,
  referenceDate = new Date(),
): WeeklyVolumePoint[] {
  const currentWeekStart = getWeekStartDate(referenceDate);
  const buckets = new Map<string, WeeklyVolumePoint>();

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = addWeeks(currentWeekStart, -index);
    buckets.set(weekStart, { weekStart, workouts: 0, sets: 0 });
  }

  for (const entry of entries) {
    const weekStart = getWeekStartDate(new Date(entry.completedAt));
    const bucket = buckets.get(weekStart);
    if (!bucket) continue;
    bucket.workouts += 1;
    bucket.sets += entry.setCount;
  }

  return [...buckets.values()];
}
