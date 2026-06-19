import {
  generatedPlanSchema,
  getWeekStartDate,
  type GeneratedPlan,
  type GeneratedWorkoutDay,
} from "@/domain/plan";
import { isOnboardingComplete, type OnboardingProfile } from "@/domain/user";
import type { ILLMPlanGenerator } from "@/application/ports/plan";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildExercises(profile: OnboardingProfile, dayIndex: number): GeneratedWorkoutDay["exercises"] {
  const hasWeights = profile.equipment.some((item) =>
    /dumbbell|barbell|kettlebell|full gym/i.test(item),
  );
  const bodyweight = profile.equipment.some((item) => /bodyweight/i.test(item));

  if (hasWeights) {
    return [
      {
        name: dayIndex % 2 === 0 ? "Goblet squat" : "Romanian deadlift",
        sets: profile.fitnessLevel === "beginner" ? 3 : 4,
        reps: profile.fitnessLevel === "advanced" ? "6-8" : "8-12",
      },
      {
        name: "Push-up variation",
        sets: 3,
        reps: profile.fitnessLevel === "beginner" ? "8-10" : "12-15",
      },
      {
        name: "Farmer carry",
        sets: 3,
        durationSeconds: 45,
      },
    ];
  }

  if (bodyweight) {
    return [
      { name: "Air squat", sets: 4, reps: "12-15" },
      { name: "Glute bridge", sets: 3, reps: "15" },
      { name: "Plank", sets: 3, durationSeconds: 45 },
    ];
  }

  return [
    { name: "March in place", sets: 1, durationSeconds: 120 },
    { name: "Wall sit", sets: 3, durationSeconds: 30 },
    { name: "Shoulder circles", sets: 2, reps: "15" },
  ];
}

/** Deterministic plan builder for dev/test and LLM fallback. */
export class StubPlanGenerator implements ILLMPlanGenerator {
  generate(profile: OnboardingProfile): Promise<GeneratedPlan> {
    if (!isOnboardingComplete(profile)) {
      throw new Error("Onboarding must be complete before generating a plan");
    }

    const weekStart = getWeekStartDate();
    const sortedDays = [...profile.availableDays].sort((a, b) => a - b);

    const days: GeneratedWorkoutDay[] = sortedDays.slice(0, 7).map((weekday, index) => {
      const dayIndex = weekday === 0 ? 6 : weekday - 1;
      const label = DAY_NAMES[dayIndex] ?? "Day";

      return {
        dayIndex,
        title: `${label} — ${profile.goals[0]?.type ?? "fitness"} focus`,
        focus: profile.goals[0]?.description.slice(0, 120),
        estimatedMinutes: profile.sessionMinutes,
        exercises: buildExercises(profile, index),
      };
    });

    if (days.length === 0) {
      days.push({
        dayIndex: 0,
        title: "Monday — starter session",
        focus: profile.goals[0]?.description.slice(0, 120),
        estimatedMinutes: profile.sessionMinutes,
        exercises: buildExercises(profile, 0),
      });
    }

    return Promise.resolve(generatedPlanSchema.parse({ weekStart, days }));
  }
}
