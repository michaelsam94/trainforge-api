import type { LoadAdjustmentResult } from "@/domain/plan/calculateAdjustedLoad";
import type { RecoverySignals } from "@/domain/wearable/deriveRecoverySignals";

const MIN_MULTIPLIER = 0.7;
const MAX_MULTIPLIER = 1.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Applies wearable recovery signals on top of session-based load adjustment.
 */
export function applyRecoveryToLoadAdjustment(
  adjustment: LoadAdjustmentResult,
  recovery: RecoverySignals | null,
  prescribedSets: number,
): LoadAdjustmentResult {
  if (!recovery?.adaptationNote) {
    return adjustment;
  }

  let delta = 0;
  if (recovery.recommendation === "deload") {
    delta = -0.05;
  } else if (recovery.recommendation === "push") {
    delta = 0.02;
  }

  const loadMultiplier = clamp(adjustment.loadMultiplier + delta, MIN_MULTIPLIER, MAX_MULTIPLIER);
  const adjustSets = Math.max(1, Math.round(prescribedSets * loadMultiplier));

  const reason =
    delta < 0
      ? `${recovery.adaptationNote} — easing today's training load.`
      : `${adjustment.reason} Wearable readiness supports a small push.`;

  return { loadMultiplier, adjustSets, reason };
}
