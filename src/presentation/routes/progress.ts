import { Hono } from "hono";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";

export const progressRoutes = new Hono<{ Bindings: Env }>();

progressRoutes.get("/summary", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.getProgressSummary.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json(result.value);
});

progressRoutes.get("/streaks", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.getStreaks.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json(result.value);
});

progressRoutes.get("/history", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");

  const result = await container.getWorkoutHistory.execute(
    user.id,
    Number.isFinite(limit) ? limit : 50,
    Number.isFinite(offset) ? offset : 0,
  );

  if (isErr(result)) {
    throw result.error;
  }

  return c.json(result.value);
});
