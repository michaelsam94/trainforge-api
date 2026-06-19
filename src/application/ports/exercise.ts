import type { ExerciseListQuery, ExerciseRecord } from "@/domain/exercise";

export type IExerciseRepository = {
  list(query: ExerciseListQuery): Promise<{ items: ExerciseRecord[]; total: number }>;
  getBySlug(slug: string): Promise<ExerciseRecord | null>;
  upsertMany(exercises: ExerciseRecord[]): Promise<number>;
  sampleByCategories(input: {
    categories: string[];
    location?: import("@/domain/exercise").ExerciseLocation;
    difficulties?: import("@/domain/exercise").ExerciseDifficulty[];
    perCategory: number;
    seed: string;
  }): Promise<Map<string, ExerciseRecord[]>>;
};
