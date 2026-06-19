import { Hono } from "hono";

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "trainforge-api",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});
