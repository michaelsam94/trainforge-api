import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";
import { requireFeature } from "@/presentation/middleware/require-feature";
import { buildPlanBodySchema, toPlanDto } from "@/presentation/dto/plan";
import { toWeekPlanDto } from "@/presentation/dto/weekPlan";
import { adaptPlanBodySchema } from "@/presentation/dto/workout";

export const planRoutes = new Hono<{ Bindings: Env }>();

planRoutes.post("/build", requireAuth(), requireFeature("manual_plan"), zValidator("json", buildPlanBodySchema), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const body = c.req.valid("json");
  const result = await container.buildManualPlan.execute({
    userId: user.id,
    mode: body.mode,
    bodyParts: body.bodyParts,
  });

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({
    planId: result.value.planId,
    status: result.value.status,
  });
});

planRoutes.post("/generate", requireAuth(), requireFeature("generate_plan"), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.generatePlan.execute({ userId: user.id });

  if (isErr(result)) {
    throw result.error;
  }

  const job = { planId: result.value.planId, userId: user.id };

  if (c.env.PLAN_QUEUE) {
    await c.env.PLAN_QUEUE.send(job);
  } else {
    c.executionCtx.waitUntil(container.generatePlan.processJob(job.planId, job.userId));
  }

  return c.json(
    {
      planId: result.value.planId,
      status: result.value.status,
    },
    202,
  );
});

planRoutes.get("/current", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.getCurrentPlan.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  if (!result.value) {
    return c.json({ plan: null });
  }

  return c.json({ plan: toPlanDto(result.value) });
});

planRoutes.get("/current/week", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.getCurrentPlan.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  if (!result.value) {
    return c.json({ plan: null });
  }

  return c.json({ plan: toWeekPlanDto(result.value) });
});

planRoutes.delete("/current", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.resetCurrentPlan.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ deleted: result.value.deleted });
});

planRoutes.patch(
  "/current/adapt",
  requireAuth(),
  requireFeature("adapt_plan"),
  zValidator("json", adaptPlanBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const body = c.req.valid("json");

    const result = await container.adaptPlan.execute({
      userId: user.id,
      workoutLogId: body.workoutLogId,
    });

    if (isErr(result)) {
      throw result.error;
    }

    const planResult = await container.getPlanById.execute(result.value.planId, user.id);
    const plan = isErr(planResult) ? null : toPlanDto(planResult.value);

    return c.json({
      adaptation: result.value.adaptation,
      plan,
    });
  },
);

planRoutes.get("/:id", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const planId = c.req.param("id");
  if (!planId) {
    throw new Error("Plan id required");
  }
  const result = await container.getPlanById.execute(planId, user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ plan: toPlanDto(result.value) });
});
