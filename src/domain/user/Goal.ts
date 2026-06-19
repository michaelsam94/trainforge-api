export type GoalType = "fitness" | "skill" | "hybrid";

export type Goal = {
  type: GoalType;
  description: string;
  targetTimelineWeeks?: number;
};

export function sanitizeGoalDescription(description: string): string {
  return description.trim().slice(0, 500);
}
