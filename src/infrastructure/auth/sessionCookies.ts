import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

export const SESSION_COOKIE = "trainforge_session";
export const CSRF_COOKIE = "trainforge_csrf";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function cookieBase(c: Context<{ Bindings: Env }>) {
  return {
    path: "/",
    sameSite: "Lax" as const,
    secure: c.env.ENVIRONMENT === "production",
  };
}

export function getSessionId(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setAuthCookies(
  c: Context<{ Bindings: Env }>,
  sessionId: string,
  csrfToken: string,
): void {
  const base = cookieBase(c);

  setCookie(c, SESSION_COOKIE, sessionId, {
    ...base,
    httpOnly: true,
    maxAge: SESSION_MAX_AGE,
  });

  setCookie(c, CSRF_COOKIE, csrfToken, {
    ...base,
    httpOnly: false,
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearAuthCookies(c: Context<{ Bindings: Env }>): void {
  const base = cookieBase(c);
  deleteCookie(c, SESSION_COOKIE, base);
  deleteCookie(c, CSRF_COOKIE, base);
}

export function toUserDto(user: {
  id: string;
  email: string;
  displayName: string;
  onboardingCompleted: boolean;
  subscriptionTier?: string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    onboardingCompleted: user.onboardingCompleted,
    subscriptionTier: user.subscriptionTier ?? "free",
  };
}
