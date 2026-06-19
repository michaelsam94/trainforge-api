export type PlanGenerationJob = {
  planId: string;
  userId: string;
};

export function isPlanGenerationJob(value: unknown): value is PlanGenerationJob {
  if (!value || typeof value !== "object") return false;
  const job = value as Record<string, unknown>;
  return typeof job.planId === "string" && typeof job.userId === "string";
}
