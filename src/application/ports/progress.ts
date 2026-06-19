import type { VolumeEntry } from "@/domain/progress";

export type WorkoutHistoryItem = {
  id: string;
  title: string;
  completedAt: string;
  setCount: number;
  difficultyRating?: number;
};

export type SetStats = {
  totalSets: number;
  weightedSets: number;
  durationSets: number;
  totalVolumeKg: number;
};

export interface IProgressRepository {
  listCompletedDates(userId: string): Promise<string[]>;
  listVolumeEntries(userId: string, sinceIso: string): Promise<VolumeEntry[]>;
  listWorkoutHistory(userId: string, limit: number, offset: number): Promise<WorkoutHistoryItem[]>;
  countTotalCompleted(userId: string): Promise<number>;
  getSetStats(userId: string): Promise<SetStats>;
  countCompletedSince(userId: string, sinceIso: string): Promise<number>;
}
