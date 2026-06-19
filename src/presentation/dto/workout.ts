import { z } from "zod";

const difficultyRatingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const logSetBodySchema = z.object({
  planDayId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(500).optional(),
  weightKg: z.number().min(0).max(500).optional(),
  durationSeconds: z.number().int().min(0).max(7200).optional(),
  idempotencyKey: z.string().min(8).max(128),
});

export const completeWorkoutBodySchema = z.object({
  workoutLogId: z.string().uuid(),
  difficultyRating: difficultyRatingSchema,
  idempotencyKey: z.string().min(8).max(128),
});

export const adaptPlanBodySchema = z.object({
  workoutLogId: z.string().uuid(),
});
