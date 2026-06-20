import type { TrainingPlan } from "@/domain/plan";

export function toWeekPlanDto(plan: TrainingPlan) {
  return {
    id: plan.id,
    status: plan.status,
    weekStart: plan.weekStart,
    days:
      plan.status === "ready"
        ? plan.days.map((day) => ({
            id: day.id,
            dayIndex: day.dayIndex,
            scheduledDate: day.scheduledDate,
            title: day.title,
            estimatedMinutes: day.estimatedMinutes,
            exercises: day.exercises.map((exercise) => ({
              id: exercise.id,
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              durationSeconds: exercise.durationSeconds,
              notes: exercise.notes,
              imageUrl: exercise.imageUrl,
              instructions: exercise.instructions,
              equipments: exercise.equipments,
              muscleGroup: exercise.muscleGroup,
              difficulty: exercise.difficulty,
            })),
          }))
        : [],
  };
}

export type WeekPlanDto = ReturnType<typeof toWeekPlanDto>;
