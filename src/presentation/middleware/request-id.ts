import type { Context, Next } from "hono";

export async function requestIdMiddleware(c: Context, next: Next): Promise<void> {
  const requestId = c.req.header("X-Request-Id") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  await next();
}

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}
