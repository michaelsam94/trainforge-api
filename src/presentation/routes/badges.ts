import { Hono } from "hono";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";

export const badgeRoutes = new Hono<{ Bindings: Env }>();

badgeRoutes.get("/", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.evaluateBadges.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json(result.value);
});
