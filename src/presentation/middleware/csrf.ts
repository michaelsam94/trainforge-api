import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { DomainError } from "@/domain/shared/errors";
import { CSRF_COOKIE } from "@/infrastructure/auth/sessionCookies";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_EXEMPT_SUFFIXES = ["/auth/register", "/auth/login", "/billing/webhook"];

export async function csrfMiddleware(c: Context, next: Next) {
  if (!MUTATION_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const path = new URL(c.req.url).pathname;
  if (CSRF_EXEMPT_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
    await next();
    return;
  }

  const cookieToken = getCookie(c, CSRF_COOKIE);
  const headerToken = c.req.header("X-CSRF-Token");

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw DomainError.validation("Invalid or missing CSRF token");
  }

  await next();
}
