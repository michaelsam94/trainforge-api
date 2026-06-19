import { z } from "zod";
import type { TrainingPlan } from "@/domain/plan";
import { BODY_PART_OPTIONS } from "@/domain/plan/exercisePlanFilters";

export const buildPlanBodySchema = z.object({
  mode: z.enum(["catalog", "body_parts"]),
  bodyParts: z.array(z.enum(BODY_PART_OPTIONS)).max(8).optional(),
});

export function toPlanDto(plan: TrainingPlan) {
  return {
    id: plan.id,
    status: plan.status,
    weekStart: plan.weekStart,
    errorMessage: plan.errorMessage,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    days: plan.days.map((day) => ({
      id: day.id,
      dayIndex: day.dayIndex,
      scheduledDate: day.scheduledDate,
      title: day.title,
      focus: day.focus,
      estimatedMinutes: day.estimatedMinutes,
      exerciseCount: day.exercises.length,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        durationSeconds: exercise.durationSeconds,
        notes: exercise.notes,
      })),
    })),
  };
}

export type PlanDto = ReturnType<typeof toPlanDto>;
