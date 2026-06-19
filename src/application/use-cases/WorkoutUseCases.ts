import { DomainError } from "@/domain/shared/errors";
import { err, isOk, ok, type Result } from "@/domain/shared/result";
import { calculateAdjustedLoad, type WorkoutDay } from "@/domain/plan";
import type { CompleteWorkoutInput, LogSetInput, WorkoutLog } from "@/domain/workout";
import type { AdaptationRecord } from "@/domain/workout";
import { applyRecoveryToLoadAdjustment } from "@/domain/wearable";
import type { IPlanAdapter, IWorkoutRepository } from "@/application/ports/workout";
import type { IPlanRepository } from "@/application/ports/plan";
import type { GetRecoverySignalsUseCase } from "@/application/use-cases/WearableUseCases";

export class LogWorkoutUseCase {
  constructor(
    private readonly workouts: IWorkoutRepository,
    private readonly plans: IPlanRepository,
  ) {}

  async execute(input: LogSetInput): Promise<Result<WorkoutLog, DomainError>> {
    const context = await this.plans.findDayById(input.planDayId, input.userId);
    if (!context) {
      return err(DomainError.notFound("plan day"));
    }

    if (context.plan.status !== "ready") {
      return err(DomainError.validation("Plan is not ready for logging"));
    }

    const workout = await this.workouts.logSet(input, context.planId);
    return ok(workout);
  }
}

export class CompleteWorkoutUseCase {
  constructor(private readonly workouts: IWorkoutRepository) {}

  async execute(input: CompleteWorkoutInput): Promise<Result<WorkoutLog, DomainError>> {
    const existing = await this.workouts.findById(input.workoutLogId, input.userId);
    if (!existing) {
      return err(DomainError.notFound("workout"));
    }

    const workout = await this.workouts.completeWorkout(input);
    return ok(workout);
  }
}

export type AdaptPlanInput = {
  userId: string;
  workoutLogId: string;
};

export type AdaptPlanResult = {
  adaptation: AdaptationRecord;
  planId: string;
};

export class AdaptPlanUseCase {
  constructor(
    private readonly workouts: IWorkoutRepository,
    private readonly plans: IPlanRepository,
    private readonly planAdapter: IPlanAdapter,
    private readonly recoverySignals: GetRecoverySignalsUseCase,
  ) {}

  async execute(input: AdaptPlanInput): Promise<Result<AdaptPlanResult, DomainError>> {
    const workout = await this.workouts.findById(input.workoutLogId, input.userId);
    if (!workout) {
      return err(DomainError.notFound("workout"));
    }

    if (workout.status !== "completed" || !workout.difficultyRating) {
      return err(DomainError.validation("Workout must be completed before adapting the plan"));
    }

    const plan = await this.plans.findById(workout.planId, input.userId);
    if (!plan) {
      return err(DomainError.notFound("plan"));
    }

    const day = plan.days.find((item: WorkoutDay) => item.id === workout.planDayId);
    if (!day) {
      return err(DomainError.notFound("plan day"));
    }

    const prescribedSets = day.exercises.reduce(
      (total: number, exercise) => total + (exercise.sets ?? 1),
      0,
    );
    const completedSets = workout.sets.filter((set) => set.completed).length;

    const adjustment = calculateAdjustedLoad({
      prescribedSets,
      completedSets,
      difficultyRating: workout.difficultyRating,
    });

    const recoveryResult = await this.recoverySignals.execute(input.userId);
    const recovery = isOk(recoveryResult) ? recoveryResult.value : null;
    const finalAdjustment = applyRecoveryToLoadAdjustment(
      adjustment,
      recovery,
      prescribedSets,
    );

    const adaptation = await this.planAdapter.applyLoadAdjustment(
      plan,
      input.userId,
      workout.id,
      finalAdjustment.adjustSets,
      finalAdjustment.loadMultiplier,
      finalAdjustment.reason,
      day.dayIndex,
    );

    return ok({ adaptation, planId: plan.id });
  }
}

export class GetWorkoutAdherenceUseCase {
  constructor(private readonly workouts: IWorkoutRepository) {}

  async execute(userId: string, weekStartIso: string): Promise<Result<{ completed: number; target: number }, DomainError>> {
    const completed = await this.workouts.countCompletedSince(userId, weekStartIso);
    return ok({ completed, target: 7 });
  }
}

export type OfflineSyncEntry = {
  clientId: string;
  kind: "log_set" | "complete_workout";
  payload: Omit<LogSetInput, "userId"> | Omit<CompleteWorkoutInput, "userId">;
};

export type OfflineSyncResultItem = {
  clientId: string;
  ok: boolean;
  error?: string;
  workoutLogId?: string;
};

export class SyncOfflineWorkoutsUseCase {
  constructor(
    private readonly logWorkout: LogWorkoutUseCase,
    private readonly completeWorkout: CompleteWorkoutUseCase,
  ) {}

  async execute(
    userId: string,
    entries: OfflineSyncEntry[],
  ): Promise<Result<{ results: OfflineSyncResultItem[] }, DomainError>> {
    const results: OfflineSyncResultItem[] = [];
    let lastWorkoutLogId: string | undefined;

    for (const entry of entries) {
      if (entry.kind === "log_set") {
        const result = await this.logWorkout.execute({
          ...(entry.payload as LogSetInput),
          userId,
        });

        if (isOk(result)) {
          lastWorkoutLogId = result.value.id;
          results.push({
            clientId: entry.clientId,
            ok: true,
            workoutLogId: result.value.id,
          });
        } else {
          results.push({
            clientId: entry.clientId,
            ok: false,
            error: result.error.message,
          });
        }
        continue;
      }

      const completePayload = entry.payload as CompleteWorkoutInput;
      const workoutLogId = completePayload.workoutLogId || lastWorkoutLogId;
      if (!workoutLogId) {
        results.push({
          clientId: entry.clientId,
          ok: false,
          error: "Missing workout log id for completion",
        });
        continue;
      }

      const result = await this.completeWorkout.execute({
        ...completePayload,
        userId,
        workoutLogId,
      });

      results.push({
        clientId: entry.clientId,
        ok: isOk(result),
        error: isOk(result) ? undefined : result.error.message,
        workoutLogId,
      });
    }

    return ok({ results });
  }
}
