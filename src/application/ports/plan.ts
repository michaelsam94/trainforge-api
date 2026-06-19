import type { GeneratedPlan, GeneratedWorkoutDay } from "@/domain/plan";
import type { OnboardingProfile } from "@/domain/user";

export interface ILLMPlanGenerator {
  generate(profile: OnboardingProfile): Promise<GeneratedPlan>;
}

export interface IPlanRepository {
  createGenerating(userId: string, weekStart: string): Promise<{ id: string }>;
  markReady(planId: string, days: GeneratedWorkoutDay[], weekStart: string): Promise<void>;
  markFailed(planId: string, message: string): Promise<void>;
  findCurrentByUserId(userId: string): Promise<import("@/domain/plan").TrainingPlan | null>;
  findById(planId: string, userId: string): Promise<import("@/domain/plan").TrainingPlan | null>;
  findDayById(
    planDayId: string,
    userId: string,
  ): Promise<{ planId: string; day: import("@/domain/plan").WorkoutDay; plan: import("@/domain/plan").TrainingPlan } | null>;
  deleteCurrentByUserId(userId: string): Promise<boolean>;
}

export interface IOnboardingReader {
  findByUserId(userId: import("@/domain/user").UserId): Promise<OnboardingProfile | null>;
}
