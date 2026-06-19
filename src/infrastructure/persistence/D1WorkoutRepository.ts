import type {
  CompleteWorkoutInput,
  LogSetInput,
  SetLog,
  WorkoutLog,
} from "@/domain/workout";
import type { IWorkoutRepository } from "@/application/ports/workout";

type WorkoutRow = {
  id: string;
  user_id: string;
  plan_id: string;
  plan_day_id: string;
  status: WorkoutLog["status"];
  difficulty_rating: number | null;
  started_at: string;
  completed_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

type SetRow = {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  completed: number;
  logged_at: string;
};

function mapSet(row: SetRow): SetLog {
  return {
    id: row.id,
    workoutLogId: row.workout_log_id,
    exerciseId: row.exercise_id,
    setNumber: row.set_number,
    reps: row.reps ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    completed: row.completed === 1,
    loggedAt: row.logged_at,
  };
}

export class D1WorkoutRepository implements IWorkoutRepository {
  constructor(private readonly db: D1Database) {}

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<WorkoutLog | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, plan_id, plan_day_id, status, difficulty_rating, started_at, completed_at, idempotency_key, created_at, updated_at
         FROM workout_logs WHERE user_id = ? AND idempotency_key = ?`,
      )
      .bind(userId, idempotencyKey)
      .first<WorkoutRow>();

    return row ? this.hydrate(row) : null;
  }

  async findActiveByPlanDay(userId: string, planDayId: string): Promise<WorkoutLog | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, plan_id, plan_day_id, status, difficulty_rating, started_at, completed_at, idempotency_key, created_at, updated_at
         FROM workout_logs
         WHERE user_id = ? AND plan_day_id = ? AND status = 'in_progress'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(userId, planDayId)
      .first<WorkoutRow>();

    return row ? this.hydrate(row) : null;
  }

  async findById(workoutLogId: string, userId: string): Promise<WorkoutLog | null> {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, plan_id, plan_day_id, status, difficulty_rating, started_at, completed_at, idempotency_key, created_at, updated_at
         FROM workout_logs WHERE id = ? AND user_id = ?`,
      )
      .bind(workoutLogId, userId)
      .first<WorkoutRow>();

    return row ? this.hydrate(row) : null;
  }

  async logSet(input: LogSetInput, planId: string): Promise<WorkoutLog> {
    const existingByKey = await this.findByIdempotencyKey(input.userId, input.idempotencyKey);
    if (existingByKey) return existingByKey;

    let workout = await this.findActiveByPlanDay(input.userId, input.planDayId);
    const now = new Date().toISOString();

    if (!workout) {
      const id = crypto.randomUUID();
      await this.db
        .prepare(
          `INSERT INTO workout_logs (id, user_id, plan_id, plan_day_id, status, started_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
        )
        .bind(id, input.userId, planId, input.planDayId, now, now, now)
        .run();
      workout = await this.findById(id, input.userId);
      if (!workout) throw new Error("Failed to create workout log");
    }

    const setId = crypto.randomUUID();
    await this.db
      .prepare(
        `INSERT INTO set_logs (id, workout_log_id, exercise_id, set_number, reps, weight_kg, duration_seconds, completed, logged_at, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(workout_log_id, exercise_id, set_number) DO UPDATE SET
           reps = excluded.reps,
           weight_kg = excluded.weight_kg,
           duration_seconds = excluded.duration_seconds,
           logged_at = excluded.logged_at`,
      )
      .bind(
        setId,
        workout.id,
        input.exerciseId,
        input.setNumber,
        input.reps ?? null,
        input.weightKg ?? null,
        input.durationSeconds ?? null,
        now,
        input.idempotencyKey,
      )
      .run();

    await this.db
      .prepare(`UPDATE workout_logs SET updated_at = ? WHERE id = ?`)
      .bind(now, workout.id)
      .run();

    const updated = await this.findById(workout.id, input.userId);
    if (!updated) throw new Error("Failed to load workout log");
    return updated;
  }

  async completeWorkout(input: CompleteWorkoutInput): Promise<WorkoutLog> {
    const existingByKey = await this.findByIdempotencyKey(input.userId, input.idempotencyKey);
    if (existingByKey?.status === "completed") return existingByKey;

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE workout_logs
         SET status = 'completed', difficulty_rating = ?, completed_at = ?, updated_at = ?, idempotency_key = ?
         WHERE id = ? AND user_id = ?`,
      )
      .bind(
        input.difficultyRating,
        now,
        now,
        input.idempotencyKey,
        input.workoutLogId,
        input.userId,
      )
      .run();

    const workout = await this.findById(input.workoutLogId, input.userId);
    if (!workout) throw new Error("Workout log not found");
    return workout;
  }

  async countCompletedSince(userId: string, sinceIso: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) as count FROM workout_logs
         WHERE user_id = ? AND status = 'completed' AND completed_at >= ?`,
      )
      .bind(userId, sinceIso)
      .first<{ count: number }>();

    return result?.count ?? 0;
  }

  private async hydrate(row: WorkoutRow): Promise<WorkoutLog> {
    const setRows = await this.db
      .prepare(
        `SELECT id, workout_log_id, exercise_id, set_number, reps, weight_kg, duration_seconds, completed, logged_at
         FROM set_logs WHERE workout_log_id = ? ORDER BY set_number ASC`,
      )
      .bind(row.id)
      .all<SetRow>();

    return {
      id: row.id,
      userId: row.user_id,
      planId: row.plan_id,
      planDayId: row.plan_day_id,
      status: row.status,
      difficultyRating: row.difficulty_rating
        ? (row.difficulty_rating as WorkoutLog["difficultyRating"])
        : undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at ?? undefined,
      sets: setRows.results.map(mapSet),
    };
  }
}
