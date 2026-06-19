export type { User, UserId, UserWithMeta, CreateUserInput } from "./User";
export { createUserId, normalizeEmail } from "./User";
export type { Goal, GoalType } from "./Goal";
export { sanitizeGoalDescription } from "./Goal";
export type {
  OnboardingProfile,
  OnboardingDraft,
  FitnessLevel,
} from "./OnboardingProfile";
export { isOnboardingComplete } from "./OnboardingProfile";
