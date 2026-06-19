import {
  type FitnessLevel,
  type Goal,
  type OnboardingDraft,
  type OnboardingProfile,
  type UserId,
} from "@/domain/user";
import type { IOnboardingRepository } from "@/application/ports";

type OnboardingRow = {
  user_id: string;
  goals_json: string;
  fitness_level: string;
  equipment_json: string;
  schedule_json: string;
  completed_at: string | null;
  updated_at: string;
};

type ScheduleJson = {
  availableDays: number[];
  sessionMinutes: number;
};

function mapRow(row: OnboardingRow): OnboardingProfile {
  const schedule = JSON.parse(row.schedule_json) as ScheduleJson;

  return {
    userId: row.user_id,
    goals: JSON.parse(row.goals_json) as Goal[],
    fitnessLevel: row.fitness_level as FitnessLevel,
    equipment: JSON.parse(row.equipment_json) as string[],
    availableDays: schedule.availableDays,
    sessionMinutes: schedule.sessionMinutes,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

export class D1OnboardingRepository implements IOnboardingRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserId(userId: UserId): Promise<OnboardingProfile | null> {
    const row = await this.db
      .prepare(
        `SELECT user_id, goals_json, fitness_level, equipment_json, schedule_json, completed_at, updated_at
         FROM onboarding_responses WHERE user_id = ?`,
      )
      .bind(userId)
      .first<OnboardingRow>();

    return row ? mapRow(row) : null;
  }

  async saveDraft(userId: UserId, draft: OnboardingDraft): Promise<OnboardingProfile> {
    const now = new Date().toISOString();
    const scheduleJson = JSON.stringify({
      availableDays: draft.availableDays,
      sessionMinutes: draft.sessionMinutes,
    });

    await this.db
      .prepare(
        `INSERT INTO onboarding_responses
         (user_id, goals_json, fitness_level, equipment_json, schedule_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           goals_json = excluded.goals_json,
           fitness_level = excluded.fitness_level,
           equipment_json = excluded.equipment_json,
           schedule_json = excluded.schedule_json,
           updated_at = excluded.updated_at`,
      )
      .bind(
        userId,
        JSON.stringify(draft.goals),
        draft.fitnessLevel,
        JSON.stringify(draft.equipment),
        scheduleJson,
        now,
      )
      .run();

    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new Error("Failed to save onboarding draft");
    }
    return profile;
  }

  async markComplete(userId: UserId): Promise<OnboardingProfile> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE onboarding_responses SET completed_at = ?, updated_at = ? WHERE user_id = ?`,
      )
      .bind(now, now, userId)
      .run();

    const profile = await this.findByUserId(userId);
    if (!profile) {
      throw new Error("Onboarding profile not found");
    }
    return { ...profile, completedAt: now, updatedAt: now };
  }
}
