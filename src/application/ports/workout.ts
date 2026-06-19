import type {
  AdaptationRecord,
  CompleteWorkoutInput,
  LogSetInput,
  WorkoutLog,
} from "@/domain/workout";
import type { TrainingPlan } from "@/domain/plan";

export interface IWorkoutRepository {
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<WorkoutLog | null>;
  findActiveByPlanDay(userId: string, planDayId: string): Promise<WorkoutLog | null>;
  findById(workoutLogId: string, userId: string): Promise<WorkoutLog | null>;
  logSet(input: LogSetInput, planId: string): Promise<WorkoutLog>;
  completeWorkout(input: CompleteWorkoutInput): Promise<WorkoutLog>;
  countCompletedSince(userId: string, sinceIso: string): Promise<number>;
}

export interface IPlanAdapter {
  applyLoadAdjustment(
    plan: TrainingPlan,
    userId: string,
    workoutLogId: string,
    adjustSets: number,
    loadMultiplier: number,
    reason: string,
    fromDayIndex: number,
  ): Promise<AdaptationRecord>;
}
