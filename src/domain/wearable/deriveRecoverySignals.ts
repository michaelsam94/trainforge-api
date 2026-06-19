import type { WearableMetric } from "@/domain/wearable/WearableMetric";

export type RecoveryRecommendation = "push" | "maintain" | "deload";

export type RecoverySignals = {
  sleepMinutes: number | null;
  restingHeartRate: number | null;
  hrvMs: number | null;
  steps: number | null;
  readinessScore: number;
  recommendation: RecoveryRecommendation;
  adaptationNote: string | null;
};

function latestMetric(
  metrics: WearableMetric[],
  type: WearableMetric["type"],
): WearableMetric | null {
  return (
    metrics
      .filter((metric) => metric.type === type)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0] ?? null
  );
}

/**
 * Pure recovery scoring from normalized wearable metrics.
 */
export function deriveRecoverySignals(metrics: WearableMetric[]): RecoverySignals {
  const sleep = latestMetric(metrics, "sleep_minutes");
  const restingHr = latestMetric(metrics, "resting_hr");
  const hrv = latestMetric(metrics, "hrv_ms");
  const steps = latestMetric(metrics, "steps");

  let score = 70;
  let recommendation: RecoveryRecommendation = "maintain";
  let adaptationNote: string | null = null;

  if (sleep) {
    if (sleep.value < 360) {
      score -= 20;
      recommendation = "deload";
      adaptationNote = "Lower intensity based on sleep";
    } else if (sleep.value >= 420) {
      score += 10;
    }
  }

  if (restingHr && restingHr.value >= 75) {
    score -= 8;
    if (recommendation !== "deload") recommendation = "maintain";
  }

  if (hrv && hrv.value < 40) {
    score -= 10;
    recommendation = "deload";
    adaptationNote = adaptationNote ?? "Lower intensity based on recovery markers";
  }

  if (steps && steps.value >= 8000) {
    score += 5;
    if (recommendation === "maintain" && score >= 80) recommendation = "push";
  }

  score = Math.min(100, Math.max(0, score));

  return {
    sleepMinutes: sleep?.value ?? null,
    restingHeartRate: restingHr?.value ?? null,
    hrvMs: hrv?.value ?? null,
    steps: steps?.value ?? null,
    readinessScore: score,
    recommendation,
    adaptationNote,
  };
}
