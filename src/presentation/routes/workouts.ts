import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";
import {
  completeWorkoutBodySchema,
  logSetBodySchema,
} from "@/presentation/dto/workout";
import { offlineSyncBodySchema } from "@/presentation/dto/offlineSync";

export const workoutRoutes = new Hono<{ Bindings: Env }>();

workoutRoutes.post("/log", requireAuth(), zValidator("json", logSetBodySchema), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const body = c.req.valid("json");

  const result = await container.logWorkout.execute({
    userId: user.id,
    ...body,
  });

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ workout: toWorkoutDto(result.value) });
});

workoutRoutes.post(
  "/complete",
  requireAuth(),
  zValidator("json", completeWorkoutBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const body = c.req.valid("json");

    const result = await container.completeWorkout.execute({
      userId: user.id,
      ...body,
    });

    if (isErr(result)) {
      throw result.error;
    }

    return c.json({ workout: toWorkoutDto(result.value) });
  },
);

workoutRoutes.get("/adherence", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const weekStart = c.req.query("weekStart") ?? new Date().toISOString().slice(0, 10);

  const result = await container.getWorkoutAdherence.execute(user.id, `${weekStart}T00:00:00.000Z`);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json(result.value);
});

workoutRoutes.post(
  "/sync",
  requireAuth(),
  zValidator("json", offlineSyncBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const body = c.req.valid("json");

    const result = await container.syncOfflineWorkouts.execute(user.id, body.entries);

    if (isErr(result)) {
      throw result.error;
    }

    return c.json(result.value);
  },
);

function toWorkoutDto(workout: import("@/domain/workout").WorkoutLog) {
  return {
    id: workout.id,
    planId: workout.planId,
    planDayId: workout.planDayId,
    status: workout.status,
    difficultyRating: workout.difficultyRating,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    sets: workout.sets.map((set) => ({
      id: set.id,
      exerciseId: set.exerciseId,
      setNumber: set.setNumber,
      reps: set.reps,
      weightKg: set.weightKg,
      durationSeconds: set.durationSeconds,
      completed: set.completed,
      loggedAt: set.loggedAt,
    })),
  };
}
