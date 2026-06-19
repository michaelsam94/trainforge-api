import { z } from "zod";

export type PlanStatus = "generating" | "ready" | "failed";

export const planExerciseSchema = z.object({
  name: z.string().min(1).max(120),
  sets: z.number().int().min(1).max(20).optional(),
  reps: z.string().max(40).optional(),
  durationSeconds: z.number().int().min(1).max(7200).optional(),
  notes: z.string().max(300).optional(),
});

export const generatedWorkoutDaySchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  title: z.string().min(1).max(120),
  focus: z.string().max(120).optional(),
  estimatedMinutes: z.number().int().min(10).max(240),
  exercises: z.array(planExerciseSchema).min(1).max(20),
});

export const generatedPlanSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(generatedWorkoutDaySchema).min(1).max(7),
});

export type PlanExercise = z.infer<typeof planExerciseSchema> & { id?: string };
export type GeneratedWorkoutDay = z.infer<typeof generatedWorkoutDaySchema>;
export type GeneratedPlan = z.infer<typeof generatedPlanSchema>;

export type PlanExerciseRecord = PlanExercise & { id: string };

export type WorkoutDay = Omit<GeneratedWorkoutDay, "exercises"> & {
  id: string;
  scheduledDate: string;
  exercises: PlanExerciseRecord[];
};

export type TrainingPlan = {
  id: string;
  userId: string;
  status: PlanStatus;
  weekStart: string;
  days: WorkoutDay[];
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export function getWeekStartDate(reference = new Date()): string {
  const date = new Date(reference);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function assignScheduledDates(
  weekStart: string,
  days: GeneratedWorkoutDay[],
): WorkoutDay[] {
  return days.map((day) => ({
    ...day,
    id: crypto.randomUUID(),
    scheduledDate: addDaysIso(weekStart, day.dayIndex),
    exercises: day.exercises.map((exercise) => ({
      ...exercise,
      id: crypto.randomUUID(),
    })),
  }));
}
