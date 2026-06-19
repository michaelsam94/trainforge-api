import type { Context, Next } from "hono";
import { createAuthMiddleware } from "@/presentation/middleware/auth";

export function requireAuth() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const container = c.get("container");
    return createAuthMiddleware(container.getCurrentUser)(c, next);
  };
}
