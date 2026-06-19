export type DifficultyRating = 1 | 2 | 3 | 4 | 5;

export type LoadAdjustmentInput = {
  prescribedSets: number;
  completedSets: number;
  difficultyRating: DifficultyRating;
  previousLoadMultiplier?: number;
};

export type LoadAdjustmentResult = {
  loadMultiplier: number;
  adjustSets: number;
  reason: string;
};

const MIN_MULTIPLIER = 0.7;
const MAX_MULTIPLIER = 1.3;

/**
 * Pure adaptation scoring from completed volume and self-reported difficulty.
 */
export function calculateAdjustedLoad(input: LoadAdjustmentInput): LoadAdjustmentResult {
  const baseMultiplier = input.previousLoadMultiplier ?? 1;
  const completionRatio =
    input.prescribedSets === 0 ? 0 : input.completedSets / input.prescribedSets;

  let delta = 0;
  let reason = "Maintaining current load based on your session.";

  if (completionRatio >= 1 && input.difficultyRating <= 2) {
    delta = 0.05;
    reason = "You completed all sets and rated the session manageable — load increased slightly.";
  } else if (completionRatio >= 1 && input.difficultyRating === 3) {
    delta = 0;
    reason = "Solid session — keeping load steady for recovery balance.";
  } else if (completionRatio < 0.75 || input.difficultyRating >= 4) {
    delta = -0.08;
    reason = "Incomplete sets or high difficulty reported — lowering intensity for recovery.";
  } else if (completionRatio < 1 && input.difficultyRating >= 3) {
    delta = -0.04;
    reason = "Partial completion with moderate difficulty — easing volume slightly.";
  }

  const loadMultiplier = clamp(baseMultiplier + delta, MIN_MULTIPLIER, MAX_MULTIPLIER);
  const adjustSets = Math.max(
    1,
    Math.round(input.prescribedSets * (loadMultiplier / baseMultiplier)),
  );

  return { loadMultiplier, adjustSets, reason };
}

export function isWorkoutComplete(
  prescribedSetsByExercise: Record<string, number>,
  completedSetsByExercise: Record<string, number>,
): boolean {
  return Object.entries(prescribedSetsByExercise).every(
    ([exerciseId, prescribed]) => (completedSetsByExercise[exerciseId] ?? 0) >= prescribed,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
