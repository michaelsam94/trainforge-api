import {
  generatedPlanSchema,
  getWeekStartDate,
  type GeneratedPlan,
  type GeneratedWorkoutDay,
  type PlanExercise,
} from "@/domain/plan";
import type { ExerciseRecord } from "@/domain/exercise";
import type { OnboardingProfile } from "@/domain/user";
import {
  pickBodyPartsForCatalog,
  pickBodyPartsForManual,
  type BodyPart,
} from "@/domain/plan/exercisePlanFilters";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type ManualPlanMode = "catalog" | "body_parts";

export type BuildCatalogPlanInput = {
  profile: OnboardingProfile;
  mode: ManualPlanMode;
  bodyParts?: string[];
  exercisesByBodyPart: Map<string, ExerciseRecord[]>;
};

function toPlanExercise(exercise: ExerciseRecord, profile: OnboardingProfile): PlanExercise {
  if (exercise.category === "cardio") {
    return {
      name: exercise.name,
      sets: 1,
      durationSeconds: Math.min(600, Math.round(profile.sessionMinutes * 12)),
      notes: exercise.equipments.join(", "),
    };
  }

  const sets =
    profile.fitnessLevel === "advanced" ? 4 : profile.fitnessLevel === "intermediate" ? 3 : 3;
  const reps =
    profile.fitnessLevel === "advanced"
      ? "6-10"
      : profile.fitnessLevel === "intermediate"
        ? "8-12"
        : "10-15";

  return {
    name: exercise.name,
    sets,
    reps,
    notes: exercise.equipments.join(", "),
  };
}

function pickExercisesForDay(
  bodyPart: BodyPart,
  exercisesByBodyPart: Map<string, ExerciseRecord[]>,
  profile: OnboardingProfile,
  count: number,
): PlanExercise[] {
  const pool = exercisesByBodyPart.get(bodyPart) ?? [];
  if (!pool.length) {
    const fallback = [...exercisesByBodyPart.values()].flat().slice(0, count);
    return fallback.map((exercise) => toPlanExercise(exercise, profile));
  }

  return pool.slice(0, count).map((exercise) => toPlanExercise(exercise, profile));
}

export function buildCatalogPlan(input: BuildCatalogPlanInput): GeneratedPlan {
  const { profile, mode, bodyParts, exercisesByBodyPart } = input;
  const sortedDays = [...profile.availableDays].sort((a, b) => a - b);
  const workoutDays = sortedDays.length ? sortedDays.slice(0, 7) : [1];
  const dayCount = workoutDays.length;

  const focusParts =
    mode === "body_parts"
      ? pickBodyPartsForManual(bodyParts ?? [], dayCount)
      : pickBodyPartsForCatalog(dayCount);

  const days: GeneratedWorkoutDay[] = workoutDays.map((weekday, index) => {
    const dayIndex = weekday === 0 ? 6 : weekday - 1;
    const label = DAY_NAMES[dayIndex] ?? "Day";
    const bodyPart = focusParts[index] ?? focusParts[0] ?? "chest";

    return {
      dayIndex,
      title: `${label} — ${bodyPart}`,
      focus: `Manual plan · ${bodyPart}`,
      estimatedMinutes: profile.sessionMinutes,
      exercises: pickExercisesForDay(bodyPart, exercisesByBodyPart, profile, 4),
    };
  });

  return generatedPlanSchema.parse({
    weekStart: getWeekStartDate(),
    days,
  });
}
