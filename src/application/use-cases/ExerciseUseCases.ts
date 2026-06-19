import type { ExerciseListQuery, ExerciseRecord } from "@/domain/exercise";
import type { IExerciseRepository } from "@/application/ports/exercise";
import { DomainError } from "@/domain/shared/errors";
import { ok, type Result } from "@/domain/shared/result";

export class ListExercisesUseCase {
  constructor(private readonly exercises: IExerciseRepository) {}

  async execute(
    query: ExerciseListQuery,
  ): Promise<Result<{ items: ExerciseRecord[]; total: number }, DomainError>> {
    const result = await this.exercises.list(query);
    return ok(result);
  }
}

export class GetExerciseUseCase {
  constructor(private readonly exercises: IExerciseRepository) {}

  async execute(slug: string): Promise<Result<ExerciseRecord | null, DomainError>> {
    const exercise = await this.exercises.getBySlug(slug);
    return ok(exercise);
  }
}
