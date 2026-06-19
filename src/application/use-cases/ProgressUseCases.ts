import { getWeekStartDate } from "@/domain/plan";
import {
  aggregateWeeklyVolume,
  calculateStreak,
  computeSkillRadar,
  evaluateBadges,
  type Badge,
  type SkillRadar,
  type StreakResult,
  type WeeklyVolumePoint,
} from "@/domain/progress";
import { ok, type Result } from "@/domain/shared/result";
import type { DomainError } from "@/domain/shared/errors";
import type { IOnboardingReader } from "@/application/ports/plan";
import type { IProgressRepository, WorkoutHistoryItem } from "@/application/ports/progress";

export type ProgressSummary = {
  adherence: { completed: number; target: number; percent: number };
  totals: { workouts: number; sets: number; volumeKg: number };
  weeklyVolume: WeeklyVolumePoint[];
  skillRadar: SkillRadar;
  streaks: StreakResult;
};

export class GetProgressSummaryUseCase {
  constructor(private readonly progress: IProgressRepository) {}

  async execute(userId: string): Promise<Result<ProgressSummary, DomainError>> {
    const weekStart = getWeekStartDate();
    const sinceIso = `${weekStart}T00:00:00.000Z`;
    const chartSince = new Date(`${weekStart}T00:00:00.000Z`);
    chartSince.setUTCDate(chartSince.getUTCDate() - 7 * 11);

    const [weeklyCompleted, totals, setStats, completedDates, volumeEntries] = await Promise.all([
      this.progress.countCompletedSince(userId, sinceIso),
      this.progress.countTotalCompleted(userId),
      this.progress.getSetStats(userId),
      this.progress.listCompletedDates(userId),
      this.progress.listVolumeEntries(userId, chartSince.toISOString()),
    ]);

    const target = 7;
    const percent = Math.round((weeklyCompleted / target) * 100);
    const streaks = calculateStreak(completedDates);
    const weightedSetRatio = setStats.totalSets === 0 ? 0 : setStats.weightedSets / setStats.totalSets;
    const durationSetRatio = setStats.totalSets === 0 ? 0 : setStats.durationSets / setStats.totalSets;

    return ok({
      adherence: { completed: weeklyCompleted, target, percent },
      totals: {
        workouts: totals,
        sets: setStats.totalSets,
        volumeKg: Math.round(setStats.totalVolumeKg * 10) / 10,
      },
      weeklyVolume: aggregateWeeklyVolume(volumeEntries, 12),
      skillRadar: computeSkillRadar({
        adherencePercent: percent,
        weightedSetRatio,
        durationSetRatio,
        totalWorkouts: totals,
      }),
      streaks,
    });
  }
}

export class GetStreaksUseCase {
  constructor(private readonly progress: IProgressRepository) {}

  async execute(userId: string): Promise<Result<StreakResult, DomainError>> {
    const completedDates = await this.progress.listCompletedDates(userId);
    return ok(calculateStreak(completedDates));
  }
}

export class GetWorkoutHistoryUseCase {
  constructor(private readonly progress: IProgressRepository) {}

  async execute(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<Result<{ items: WorkoutHistoryItem[] }, DomainError>> {
    const items = await this.progress.listWorkoutHistory(userId, limit, offset);
    return ok({ items });
  }
}

export class EvaluateBadgesUseCase {
  constructor(
    private readonly progress: IProgressRepository,
    private readonly onboarding: IOnboardingReader,
  ) {}

  async execute(userId: string): Promise<Result<{ badges: Badge[] }, DomainError>> {
    const weekStart = getWeekStartDate();
    const sinceIso = `${weekStart}T00:00:00.000Z`;

    const [totalWorkouts, setStats, completedDates, weeklyCompleted, profile] = await Promise.all([
      this.progress.countTotalCompleted(userId),
      this.progress.getSetStats(userId),
      this.progress.listCompletedDates(userId),
      this.progress.countCompletedSince(userId, sinceIso),
      this.onboarding.findByUserId(userId as import("@/domain/user").UserId),
    ]);

    const streaks = calculateStreak(completedDates);
    const badges = evaluateBadges({
      totalWorkouts,
      totalSets: setStats.totalSets,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      weeklyCompleted,
      fitnessLevel: profile?.fitnessLevel,
    });

    return ok({ badges });
  }
}
