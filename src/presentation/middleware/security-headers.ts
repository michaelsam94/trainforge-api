import type { Context, Next } from "hono";

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self' https:",
  "font-src 'self' data:",
].join("; ");

export async function securityHeadersMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
) {
  await next();

  c.header("Content-Security-Policy", CSP);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-site");

  if (c.env.ENVIRONMENT === "production") {
    c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}
