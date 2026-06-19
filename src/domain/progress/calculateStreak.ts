export type StreakResult = {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
};

function normalizeDay(iso: string): string {
  return iso.slice(0, 10);
}

function dayDiff(later: string, earlier: string): number {
  const start = new Date(`${earlier}T00:00:00.000Z`).getTime();
  const end = new Date(`${later}T00:00:00.000Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * Computes workout streaks from distinct completion dates (ISO strings).
 * Current streak stays active if the last workout was today or yesterday.
 */
export function calculateStreak(
  completedDates: string[],
  referenceDate: string = new Date().toISOString().slice(0, 10),
): StreakResult {
  const days = [...new Set(completedDates.map(normalizeDay))].sort();
  if (days.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastWorkoutDate: null };
  }

  let longest = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    const previous = days[index - 1];
    const current = days[index];
    if (!previous || !current) continue;
    if (dayDiff(current, previous) === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const last = days.at(-1);
  if (!last) {
    return { currentStreak: 0, longestStreak: 0, lastWorkoutDate: null };
  }

  const gapFromToday = dayDiff(referenceDate, last);
  let current = 0;

  if (gapFromToday <= 1) {
    current = 1;
    for (let index = days.length - 2; index >= 0; index -= 1) {
      const earlier = days[index];
      const later = days[index + 1];
      if (!earlier || !later) break;
      if (dayDiff(later, earlier) === 1) {
        current += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak: current, longestStreak: longest, lastWorkoutDate: last };
}
