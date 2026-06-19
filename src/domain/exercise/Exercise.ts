export type ExerciseLocation = "home" | "gym" | "both";
export type ExerciseDifficulty = "easy" | "medium" | "hard";

export type ExerciseRecord = {
  id: string;
  slug: string;
  name: string;
  category: string;
  muscleGroup: string | null;
  utility: string | null;
  mechanics: string | null;
  forceType: string | null;
  preparation: string | null;
  execution: string | null;
  instructions: string[];
  equipments: string[];
  location: ExerciseLocation;
  difficulty: ExerciseDifficulty;
  sourceUrl: string;
  thumbnailUrl: string | null;
  localThumbnailPath: string | null;
  videoUrl: string | null;
  vimeoId: string | null;
  isPremium: boolean;
  listSeed: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseListQuery = {
  q?: string;
  category?: string;
  muscleGroup?: string;
  location?: ExerciseLocation;
  difficulty?: ExerciseDifficulty;
  limit: number;
  offset: number;
};
