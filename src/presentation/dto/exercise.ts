import { z } from "zod";
import type { ExerciseRecord } from "@/domain/exercise";

export const listExercisesQuerySchema = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(80).optional(),
  muscleGroup: z.string().max(80).optional(),
  location: z.enum(["home", "gym", "both"]).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export function toExerciseDto(exercise: ExerciseRecord) {
  return {
    id: exercise.id,
    slug: exercise.slug,
    name: exercise.name,
    category: exercise.category,
    muscleGroup: exercise.muscleGroup,
    utility: exercise.utility,
    mechanics: exercise.mechanics,
    forceType: exercise.forceType,
    preparation: exercise.preparation,
    execution: exercise.execution,
    instructions: exercise.instructions,
    equipments: exercise.equipments,
    location: exercise.location,
    difficulty: exercise.difficulty,
    sourceUrl: exercise.sourceUrl,
    thumbnailUrl: exercise.thumbnailUrl,
    imageUrl: exercise.localThumbnailPath ?? exercise.thumbnailUrl,
    videoUrl: exercise.videoUrl,
    vimeoId: exercise.vimeoId,
    isPremium: exercise.isPremium,
  };
}
