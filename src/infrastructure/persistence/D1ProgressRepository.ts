import type {
  IProgressRepository,
  SetStats,
  WorkoutHistoryItem,
} from "@/application/ports/progress";
import type { VolumeEntry } from "@/domain/progress";

type DateRow = { day: string };
type VolumeRow = { completed_at: string; set_count: number };
type HistoryRow = {
  id: string;
  title: string;
  completed_at: string;
  set_count: number;
  difficulty_rating: number | null;
};
type CountRow = { count: number };
type SetStatsRow = {
  total_sets: number;
  weighted_sets: number;
  duration_sets: number;
  total_volume_kg: number;
};

export class D1ProgressRepository implements IProgressRepository {
  constructor(private readonly db: D1Database) {}

  async listCompletedDates(userId: string): Promise<string[]> {
    const result = await this.db
      .prepare(
        `SELECT DISTINCT substr(completed_at, 1, 10) AS day
         FROM workout_logs
         WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
         ORDER BY day ASC`,
      )
      .bind(userId)
      .all<DateRow>();

    return result.results.map((row) => `${row.day}T12:00:00.000Z`);
  }

  async listVolumeEntries(userId: string, sinceIso: string): Promise<VolumeEntry[]> {
    const result = await this.db
      .prepare(
        `SELECT wl.completed_at,
                (SELECT COUNT(*) FROM set_logs sl WHERE sl.workout_log_id = wl.id) AS set_count
         FROM workout_logs wl
         WHERE wl.user_id = ? AND wl.status = 'completed' AND wl.completed_at >= ?
         ORDER BY wl.completed_at ASC`,
      )
      .bind(userId, sinceIso)
      .all<VolumeRow>();

    return result.results.map((row) => ({
      completedAt: row.completed_at,
      setCount: row.set_count,
    }));
  }

  async listWorkoutHistory(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<WorkoutHistoryItem[]> {
    const result = await this.db
      .prepare(
        `SELECT wl.id,
                pd.title,
                wl.completed_at,
                wl.difficulty_rating,
                (SELECT COUNT(*) FROM set_logs sl WHERE sl.workout_log_id = wl.id) AS set_count
         FROM workout_logs wl
         JOIN plan_days pd ON pd.id = wl.plan_day_id
         WHERE wl.user_id = ? AND wl.status = 'completed'
         ORDER BY wl.completed_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(userId, limit, offset)
      .all<HistoryRow>();

    return result.results.map(mapHistoryRow);
  }

  async countTotalCompleted(userId: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM workout_logs
         WHERE user_id = ? AND status = 'completed'`,
      )
      .bind(userId)
      .first<CountRow>();

    return result?.count ?? 0;
  }

  async getSetStats(userId: string): Promise<SetStats> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) AS total_sets,
                SUM(CASE WHEN sl.weight_kg IS NOT NULL AND sl.weight_kg > 0 THEN 1 ELSE 0 END) AS weighted_sets,
                SUM(CASE WHEN sl.duration_seconds IS NOT NULL AND sl.duration_seconds > 0 THEN 1 ELSE 0 END) AS duration_sets,
                COALESCE(SUM(sl.weight_kg * COALESCE(sl.reps, 1)), 0) AS total_volume_kg
         FROM set_logs sl
         JOIN workout_logs wl ON wl.id = sl.workout_log_id
         WHERE wl.user_id = ?`,
      )
      .bind(userId)
      .first<SetStatsRow>();

    return {
      totalSets: result?.total_sets ?? 0,
      weightedSets: result?.weighted_sets ?? 0,
      durationSets: result?.duration_sets ?? 0,
      totalVolumeKg: result?.total_volume_kg ?? 0,
    };
  }

  async countCompletedSince(userId: string, sinceIso: string): Promise<number> {
    const result = await this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM workout_logs
         WHERE user_id = ? AND status = 'completed' AND completed_at >= ?`,
      )
      .bind(userId, sinceIso)
      .first<CountRow>();

    return result?.count ?? 0;
  }
}

function mapHistoryRow(row: HistoryRow): WorkoutHistoryItem {
  return {
    id: row.id,
    title: row.title,
    completedAt: row.completed_at,
    setCount: row.set_count,
    difficultyRating: row.difficulty_rating ?? undefined,
  };
}
