import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createContainer } from "@/composition/container";
import { requestIdMiddleware } from "@/presentation/middleware/request-id";
import { errorHandler } from "@/presentation/middleware/error-handler";
import { rateLimitMiddleware } from "@/presentation/middleware/validation";
import { csrfMiddleware } from "@/presentation/middleware/csrf";
import { securityHeadersMiddleware } from "@/presentation/middleware/security-headers";
import { healthRoutes } from "@/presentation/routes/health";
import { authRoutes } from "@/presentation/routes/auth";
import { planRoutes } from "@/presentation/routes/plans";
import { workoutRoutes } from "@/presentation/routes/workouts";
import { progressRoutes } from "@/presentation/routes/progress";
import { badgeRoutes } from "@/presentation/routes/badges";
import { chatRoutes } from "@/presentation/routes/chat";
import { wearableRoutes } from "@/presentation/routes/wearables";
import { billingRoutes } from "@/presentation/routes/billing";
import { communityRoutes } from "@/presentation/routes/community";
import { exerciseRoutes } from "@/presentation/routes/exercises";
import { requireAuth } from "@/presentation/middleware/require-auth";

export function createApp(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.use("*", logger());
  app.use("*", securityHeadersMiddleware);
  app.use("*", requestIdMiddleware);
  app.use("*", rateLimitMiddleware);
  app.use(
    "*",
    cors({
      origin: (origin) => origin || "*",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-CSRF-Token"],
      credentials: true,
      maxAge: 86400,
    }),
  );

  app.use("*", async (c, next) => {
    c.set("container", createContainer(c.env));
    await next();
  });

  app.use("*", csrfMiddleware);

  app.route("/health", healthRoutes);

  app.get("/protected-demo", requireAuth(), (c) =>
    c.json({ message: "You are authenticated", userId: c.get("currentUser").id }),
  );

  app.route("/auth", authRoutes);
  app.route("/plans", planRoutes);
  app.route("/workouts", workoutRoutes);
  app.route("/progress", progressRoutes);
  app.route("/badges", badgeRoutes);
  app.route("/chat", chatRoutes);
  app.route("/wearables", wearableRoutes);
  app.route("/billing", billingRoutes);
  app.route("/community", communityRoutes);
  app.route("/exercises", exerciseRoutes);

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
          requestId: c.get("requestId"),
        },
      },
      404,
    ),
  );

  app.onError(errorHandler);

  return app;
}
