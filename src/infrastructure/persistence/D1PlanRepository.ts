import {
  assignScheduledDates,
  type GeneratedWorkoutDay,
  type PlanStatus,
  type TrainingPlan,
  type WorkoutDay,
} from "@/domain/plan";
import type { IPlanRepository } from "@/application/ports/plan";

const MAX_PLAN_EXERCISE_SETS = 5;

function normalizePlanExerciseSets(value: number | null | undefined): number {
  if (!Number.isFinite(value) || value == null) return 3;
  return Math.min(MAX_PLAN_EXERCISE_SETS, Math.max(1, Math.trunc(value)));
}


type PlanRow = {
  id: string;
  user_id: string;
  status: PlanStatus;
  week_start: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type DayRow = {
  id: string;
  plan_id: string;
  day_index: number;
  scheduled_date: string;
  title: string;
  focus: string | null;
  estimated_minutes: number;
  sort_order: number;
};

type ExerciseRow = {
  id: string;
  plan_day_id: string;
  name: string;
  sets: number | null;
  reps: string | null;
  duration_seconds: number | null;
  notes: string | null;
  sort_order: number;
};

export class D1PlanRepository implements IPlanRepository {
  constructor(private readonly db: D1Database) {}

  async createGenerating(userId: string, weekStart: string): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO plans (id, user_id, status, week_start, created_at, updated_at)
         VALUES (?, ?, 'generating', ?, ?, ?)`,
      )
      .bind(id, userId, weekStart, now, now)
      .run();

    return { id };
  }

  async markReady(
    planId: string,
    generatedDays: GeneratedWorkoutDay[],
    weekStart: string,
  ): Promise<void> {
    const days = assignScheduledDates(weekStart, generatedDays);
    const now = new Date().toISOString();

    for (const [index, day] of days.entries()) {
      await this.db
        .prepare(
          `INSERT INTO plan_days
           (id, plan_id, day_index, scheduled_date, title, focus, estimated_minutes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          day.id,
          planId,
          day.dayIndex,
          day.scheduledDate,
          day.title,
          day.focus ?? null,
          day.estimatedMinutes,
          index,
        )
        .run();

      for (const [exerciseIndex, exercise] of day.exercises.entries()) {
        await this.db
          .prepare(
            `INSERT INTO plan_exercises
             (id, plan_day_id, name, sets, reps, duration_seconds, notes, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            exercise.id,
            day.id,
            exercise.name,
            normalizePlanExerciseSets(exercise.sets) ?? null,
            exercise.reps ?? null,
            exercise.durationSeconds ?? null,
            exercise.notes ?? null,
            exerciseIndex,
          )
          .run();
      }
    }

    await this.db
      .prepare(`UPDATE plans SET status = 'ready', updated_at = ?, error_message = NULL WHERE id = ?`)
      .bind(now, planId)
      .run();
  }

  async markFailed(planId: string, message: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`UPDATE plans SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`)
      .bind(message, now, planId)
      .run();
  }

  async findCurrentByUserId(userId: string): Promise<TrainingPlan | null> {
    const plan = await this.db
      .prepare(
        `SELECT id, user_id, status, week_start, error_message, created_at, updated_at
         FROM plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(userId)
      .first<PlanRow>();

    if (!plan) return null;
    return this.hydratePlan(plan);
  }

  async findById(planId: string, userId: string): Promise<TrainingPlan | null> {
    const plan = await this.db
      .prepare(
        `SELECT id, user_id, status, week_start, error_message, created_at, updated_at
         FROM plans WHERE id = ? AND user_id = ?`,
      )
      .bind(planId, userId)
      .first<PlanRow>();

    if (!plan) return null;
    return this.hydratePlan(plan);
  }

  async deleteCurrentByUserId(userId: string): Promise<boolean> {
    const current = await this.findCurrentByUserId(userId);
    if (!current) return false;

    await this.db
      .prepare("DELETE FROM plans WHERE id = ? AND user_id = ?")
      .bind(current.id, userId)
      .run();

    return true;
  }

  async findDayById(
    planDayId: string,
    userId: string,
  ): Promise<{ planId: string; day: WorkoutDay; plan: TrainingPlan } | null> {
    const plan = await this.db
      .prepare(
        `SELECT p.id, p.user_id, p.status, p.week_start, p.error_message, p.created_at, p.updated_at
         FROM plan_days pd
         JOIN plans p ON p.id = pd.plan_id
         WHERE pd.id = ? AND p.user_id = ?`,
      )
      .bind(planDayId, userId)
      .first<PlanRow>();

    if (!plan) return null;

    const hydrated = await this.hydratePlan(plan);
    const day = hydrated.days.find((item) => item.id === planDayId);
    if (!day) return null;

    return { planId: plan.id, day, plan: hydrated };
  }

  private async hydratePlan(plan: PlanRow): Promise<TrainingPlan> {
    const dayRows = await this.db
      .prepare(
        `SELECT id, plan_id, day_index, scheduled_date, title, focus, estimated_minutes, sort_order
         FROM plan_days WHERE plan_id = ? ORDER BY sort_order ASC`,
      )
      .bind(plan.id)
      .all<DayRow>();

    const days: WorkoutDay[] = [];

    for (const dayRow of dayRows.results) {
      const exerciseRows = await this.db
        .prepare(
          `SELECT id, plan_day_id, name, sets, reps, duration_seconds, notes, sort_order
           FROM plan_exercises WHERE plan_day_id = ? ORDER BY sort_order ASC`,
        )
        .bind(dayRow.id)
        .all<ExerciseRow>();

      days.push({
        id: dayRow.id,
        dayIndex: dayRow.day_index,
        scheduledDate: dayRow.scheduled_date,
        title: dayRow.title,
        focus: dayRow.focus ?? undefined,
        estimatedMinutes: dayRow.estimated_minutes,
        exercises: exerciseRows.results.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          sets: normalizePlanExerciseSets(exercise.sets) ?? undefined,
          reps: exercise.reps ?? undefined,
          durationSeconds: exercise.duration_seconds ?? undefined,
          notes: exercise.notes ?? undefined,
        })),
      });
    }

    return {
      id: plan.id,
      userId: plan.user_id,
      status: plan.status,
      weekStart: plan.week_start,
      days,
      errorMessage: plan.error_message ?? undefined,
      createdAt: plan.created_at,
      updatedAt: plan.updated_at,
    };
  }
}
