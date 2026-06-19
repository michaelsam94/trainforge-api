import { describe, expect, it } from "vitest";
import {
  applyRecoveryToLoadAdjustment,
  deriveRecoverySignals,
  type WearableMetric,
} from "@/domain/wearable";
import { calculateAdjustedLoad } from "@/domain/plan";
import { AdaptPlanUseCase } from "@/application/use-cases/WorkoutUseCases";
import { GetRecoverySignalsUseCase } from "@/application/use-cases/WearableUseCases";
import type { IPlanAdapter, IWorkoutRepository } from "@/application/ports/workout";
import type { IPlanRepository } from "@/application/ports/plan";
import type { IWearableMetricRepository } from "@/application/ports/wearable";
import type { TrainingPlan, WorkoutDay } from "@/domain/plan";
import type { WorkoutLog } from "@/domain/workout";
import { isOk } from "@/domain/shared/result";

const poorSleepMetrics: WearableMetric[] = [
  {
    provider: "fitbit",
    type: "sleep_minutes",
    value: 300,
    unit: "minutes",
    recordedAt: "2026-06-18T08:00:00.000Z",
  },
];

describe("deriveRecoverySignals", () => {
  it("recommends deload when sleep is low", () => {
    const recovery = deriveRecoverySignals(poorSleepMetrics);
    expect(recovery.recommendation).toBe("deload");
    expect(recovery.adaptationNote).toContain("sleep");
  });
});

describe("applyRecoveryToLoadAdjustment", () => {
  it("lowers load when recovery note is present", () => {
    const base = calculateAdjustedLoad({
      prescribedSets: 4,
      completedSets: 4,
      difficultyRating: 3,
    });
    const recovery = deriveRecoverySignals(poorSleepMetrics);
    const adjusted = applyRecoveryToLoadAdjustment(base, recovery, 4);

    expect(adjusted.loadMultiplier).toBeLessThan(base.loadMultiplier);
    expect(adjusted.reason).toContain("sleep");
  });
});

class MemoryMetricRepository implements IWearableMetricRepository {
  constructor(private readonly metrics: WearableMetric[]) {}

  async upsertMetrics(): Promise<void> {
    return;
  }

  async listRecent(): Promise<WearableMetric[]> {
    return this.metrics;
  }

  async pruneOlderThan(): Promise<void> {
    return;
  }
}

class MemoryWorkoutRepository implements IWorkoutRepository {
  constructor(private readonly workout: WorkoutLog) {}

  async findById(): Promise<WorkoutLog | null> {
    return this.workout;
  }

  async findByIdempotencyKey(): Promise<WorkoutLog | null> {
    return null;
  }

  async findActiveByPlanDay(): Promise<WorkoutLog | null> {
    return null;
  }

  async logSet(): Promise<WorkoutLog> {
    return this.workout;
  }

  async completeWorkout(): Promise<WorkoutLog> {
    return this.workout;
  }

  async countCompletedSince(): Promise<number> {
    return 0;
  }
}

class MemoryPlanRepository implements IPlanRepository {
  constructor(private readonly plan: TrainingPlan) {}

  async createGenerating() {
    return { id: this.plan.id };
  }

  async markReady() {
    return;
  }

  async markFailed() {
    return;
  }

  async findCurrentByUserId() {
    return this.plan;
  }

  async findById() {
    return this.plan;
  }

  async findDayById(_planDayId: string, _userId: string) {
    const day = this.plan.days[0];
    if (!day) return null;
    return { planId: this.plan.id, day, plan: this.plan };
  }

  async deleteCurrentByUserId() {
    return true;
  }
}

class MemoryPlanAdapter implements IPlanAdapter {
  lastReason = "";

  async applyLoadAdjustment(
    _plan: TrainingPlan,
    _userId: string,
    _workoutLogId: string,
    _adjustSets: number,
    _loadMultiplier: number,
    reason: string,
    _fromDayIndex: number,
  ) {
    this.lastReason = reason;
    return {
      id: crypto.randomUUID(),
      planId: "plan-1",
      reason,
      loadMultiplier: _loadMultiplier,
      createdAt: new Date().toISOString(),
    };
  }
}

describe("AdaptPlanUseCase with recovery signals", () => {
  it("includes wearable sleep context in adaptation reason", async () => {
    const day: WorkoutDay = {
      id: "day-1",
      dayIndex: 0,
      scheduledDate: "2026-06-19",
      title: "Strength",
      estimatedMinutes: 45,
      exercises: [{ id: "ex-1", name: "Squat", sets: 4, reps: "8" }],
    };

    const plan: TrainingPlan = {
      id: "plan-1",
      userId: "user-1",
      status: "ready",
      weekStart: "2026-06-16",
      days: [day],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const workout: WorkoutLog = {
      id: "workout-1",
      userId: "user-1",
      planId: "plan-1",
      planDayId: "day-1",
      status: "completed",
      difficultyRating: 3,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      sets: Array.from({ length: 4 }).map((_, index) => ({
        id: `set-${String(index)}`,
        workoutLogId: "workout-1",
        exerciseId: "ex-1",
        setNumber: index + 1,
        completed: true,
        loggedAt: new Date().toISOString(),
      })),
    };

    const planAdapter = new MemoryPlanAdapter();
    const useCase = new AdaptPlanUseCase(
      new MemoryWorkoutRepository(workout),
      new MemoryPlanRepository(plan),
      planAdapter,
      new GetRecoverySignalsUseCase(new MemoryMetricRepository(poorSleepMetrics)),
    );

    const result = await useCase.execute({ userId: "user-1", workoutLogId: "workout-1" });
    expect(isOk(result)).toBe(true);
    expect(planAdapter.lastReason.toLowerCase()).toContain("sleep");
  });
});
