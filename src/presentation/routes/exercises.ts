import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { DomainError } from "@/domain/shared/errors";
import { isErr } from "@/domain/shared/result";
import { listExercisesQuerySchema, toExerciseDto } from "@/presentation/dto/exercise";

export const exerciseRoutes = new Hono<{ Bindings: Env }>();

exerciseRoutes.get("/", zValidator("query", listExercisesQuerySchema), async (c) => {
  const container = c.get("container");
  const query = c.req.valid("query");
  const result = await container.listExercises.execute({
    q: query.q,
    category: query.category,
    muscleGroup: query.muscleGroup,
    location: query.location,
    difficulty: query.difficulty,
    limit: query.limit,
    offset: query.offset,
  });

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({
    total: result.value.total,
    count: result.value.items.length,
    exercises: result.value.items.map(toExerciseDto),
  });
});

exerciseRoutes.get("/:slug", async (c) => {
  const container = c.get("container");
  const slug = c.req.param("slug");
  const result = await container.getExercise.execute(slug);

  if (isErr(result)) {
    throw result.error;
  }

  if (!result.value) {
    throw new DomainError("NOT_FOUND", "Exercise not found");
  }

  return c.json({ exercise: toExerciseDto(result.value) });
});
