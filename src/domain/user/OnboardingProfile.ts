import type { Goal } from "./Goal";

export type FitnessLevel = "beginner" | "intermediate" | "advanced";

export type OnboardingProfile = {
  userId: string;
  goals: Goal[];
  fitnessLevel: FitnessLevel;
  equipment: string[];
  availableDays: number[];
  sessionMinutes: number;
  completedAt: string | null;
  updatedAt: string;
};

export type OnboardingDraft = {
  goals: Goal[];
  fitnessLevel: FitnessLevel;
  equipment: string[];
  availableDays: number[];
  sessionMinutes: number;
};

export function isOnboardingComplete(profile: OnboardingProfile | null): boolean {
  return profile?.completedAt != null;
}
