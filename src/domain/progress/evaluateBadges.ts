export type BadgeId =
  | "first_workout"
  | "week_warrior"
  | "streak_7"
  | "streak_28"
  | "century_sets"
  | "skill_intermediate";

export type Badge = {
  id: BadgeId;
  title: string;
  description: string;
  earned: boolean;
};

export type BadgeEvaluationInput = {
  totalWorkouts: number;
  totalSets: number;
  currentStreak: number;
  longestStreak: number;
  weeklyCompleted: number;
  fitnessLevel?: string;
};

const BADGE_DEFINITIONS: Omit<Badge, "earned">[] = [
  {
    id: "first_workout",
    title: "First workout",
    description: "Complete your first logged session.",
  },
  {
    id: "week_warrior",
    title: "Week warrior",
    description: "Finish every planned workout in a week.",
  },
  {
    id: "streak_7",
    title: "7-day streak",
    description: "Train on seven consecutive days.",
  },
  {
    id: "streak_28",
    title: "4-week streak",
    description: "Maintain a 28-day training streak.",
  },
  {
    id: "century_sets",
    title: "Century sets",
    description: "Log 100 total sets.",
  },
  {
    id: "skill_intermediate",
    title: "Skill: Intermediate",
    description: "Reach intermediate level with consistent training.",
  },
];

export function evaluateBadges(input: BadgeEvaluationInput): Badge[] {
  const earnedIds = new Set<BadgeId>();

  if (input.totalWorkouts >= 1) earnedIds.add("first_workout");
  if (input.weeklyCompleted >= 7) earnedIds.add("week_warrior");
  if (input.currentStreak >= 7 || input.longestStreak >= 7) earnedIds.add("streak_7");
  if (input.currentStreak >= 28 || input.longestStreak >= 28) earnedIds.add("streak_28");
  if (input.totalSets >= 100) earnedIds.add("century_sets");

  const intermediatePlus = input.fitnessLevel === "intermediate" || input.fitnessLevel === "advanced";
  if (intermediatePlus && input.totalWorkouts >= 5) {
    earnedIds.add("skill_intermediate");
  }

  return BADGE_DEFINITIONS.map((badge) => ({
    ...badge,
    earned: earnedIds.has(badge.id),
  }));
}
