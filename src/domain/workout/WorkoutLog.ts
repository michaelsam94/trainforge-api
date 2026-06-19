import type { DifficultyRating } from "@/domain/plan/calculateAdjustedLoad";

export type WorkoutStatus = "in_progress" | "completed";

export type SetLog = {
  id: string;
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  completed: boolean;
  loggedAt: string;
};

export type WorkoutLog = {
  id: string;
  userId: string;
  planId: string;
  planDayId: string;
  status: WorkoutStatus;
  difficultyRating?: DifficultyRating;
  startedAt: string;
  completedAt?: string;
  sets: SetLog[];
};

export type LogSetInput = {
  userId: string;
  planDayId: string;
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  idempotencyKey: string;
};

export type CompleteWorkoutInput = {
  userId: string;
  workoutLogId: string;
  difficultyRating: DifficultyRating;
  idempotencyKey: string;
};

export type AdaptationRecord = {
  id: string;
  planId: string;
  reason: string;
  loadMultiplier: number;
  createdAt: string;
};
