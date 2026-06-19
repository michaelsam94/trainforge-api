import type { TrainingPlan } from "@/domain/plan";
import type { AdaptationRecord } from "@/domain/workout";
import type { IPlanAdapter } from "@/application/ports/workout";

export class D1PlanAdapter implements IPlanAdapter {
  constructor(private readonly db: D1Database) {}

  async applyLoadAdjustment(
    plan: TrainingPlan,
    userId: string,
    workoutLogId: string,
    adjustSets: number,
    loadMultiplier: number,
    reason: string,
    fromDayIndex: number,
  ): Promise<AdaptationRecord> {
    const adaptationId = crypto.randomUUID();
    const now = new Date().toISOString();

    for (const day of plan.days) {
      if (day.dayIndex < fromDayIndex) continue;

      for (const exercise of day.exercises) {
        if (!exercise.sets) continue;
        const scaledSets = Math.max(1, Math.round(exercise.sets * loadMultiplier));
        const nextSets = day.dayIndex === fromDayIndex ? adjustSets : scaledSets;

        await this.db
          .prepare(`UPDATE plan_exercises SET sets = ? WHERE id = ?`)
          .bind(nextSets, exercise.id)
          .run();
      }
    }

    await this.db
      .prepare(
        `INSERT INTO plan_adaptations (id, plan_id, user_id, workout_log_id, reason, load_multiplier, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(adaptationId, plan.id, userId, workoutLogId, reason, loadMultiplier, now)
      .run();

    return {
      id: adaptationId,
      planId: plan.id,
      reason,
      loadMultiplier,
      createdAt: now,
    };
  }
}
