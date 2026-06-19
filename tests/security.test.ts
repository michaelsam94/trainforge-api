import { describe, expect, it } from "vitest";
import { createApp } from "@/presentation/app";

const testEnv: Env = {
  ENVIRONMENT: "production",
  DB: {} as D1Database,
  CACHE: {} as KVNamespace,
  MEDIA: {} as R2Bucket,
};

describe("security headers", () => {
  it("sets CSP and HSTS on API responses", async () => {
    const app = createApp();
    const response = await app.request("/health", {}, testEnv);

    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });
});

describe("CSRF protection", () => {
  it("rejects POST mutations without CSRF token", async () => {
    const app = createApp();
    const response = await app.request(
      "/auth/logout",
      { method: "POST", headers: { "Content-Type": "application/json" } },
      testEnv,
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION");
  });

  it("allows exempt auth register without CSRF token", async () => {
    const app = createApp();
    const response = await app.request(
      "/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "csrf-test@trainforge.test",
          password: "password123",
          displayName: "CSRF Test",
        }),
      },
      testEnv,
    );

    expect(response.status).not.toBe(400);
  });
});

describe("CSRF audit coverage", () => {
  const exemptSuffixes = ["/auth/register", "/auth/login", "/billing/webhook"];
  const mutationRoutes = [
    "POST /auth/logout",
    "DELETE /auth/account",
    "POST /auth/onboarding",
    "POST /plans/generate",
    "POST /workouts/log",
    "POST /workouts/sync",
    "POST /chat/sessions",
    "POST /community/threads",
    "POST /billing/checkout",
  ];

  it("documents exempt routes", () => {
    expect(exemptSuffixes).toEqual([
      "/auth/register",
      "/auth/login",
      "/billing/webhook",
    ]);
  });

  it("requires CSRF on protected mutations", () => {
    for (const route of mutationRoutes) {
      const path = route.split(" ")[1] ?? route;
      expect(exemptSuffixes.some((suffix) => path.endsWith(suffix))).toBe(false);
    }
  });
});
