import type { Context, Next } from "hono";
import { z } from "zod";

export const healthQuerySchema = z.object({
  verbose: z.enum(["true", "false"]).optional(),
});

/** KV-backed rate limiting — wired in Phase 2 when auth routes land. */
export async function rateLimitMiddleware(c: Context, next: Next): Promise<void> {
  c.header("X-RateLimit-Limit", "100");
  await next();
}
