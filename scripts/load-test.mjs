#!/usr/bin/env node
/**
 * Load smoke test for plan generation and chat endpoints.
 * Usage: API_URL=http://localhost:2020 node scripts/load-test.mjs
 *
 * Requires a valid session cookie — run after registering a test user or pass
 * SESSION_COOKIE and CSRF_TOKEN env vars.
 */

const API_URL = process.env.API_URL ?? "http://localhost:2020";
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? "5");
const ITERATIONS = Number(process.env.LOAD_ITERATIONS ?? "10");
const SESSION_COOKIE = process.env.SESSION_COOKIE;
const CSRF_TOKEN = process.env.CSRF_TOKEN;

async function registerTestUser() {
  const email = `load-${Date.now()}@trainforge.test`;
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      displayName: "Load Test",
    }),
  });

  if (!response.ok) {
    throw new Error(`Register failed: ${response.status}`);
  }

  const setCookie = response.headers.getSetCookie?.() ?? [];
  const session = setCookie.find((c) => c.startsWith("trainforge_session="));
  const csrf = setCookie.find((c) => c.startsWith("trainforge_csrf="));
  const sessionValue = session?.match(/trainforge_session=([^;]+)/)?.[1];
  const csrfValue = csrf?.match(/trainforge_csrf=([^;]+)/)?.[1];

  if (!sessionValue || !csrfValue) {
    throw new Error("Missing session cookies from register response");
  }

  return { sessionCookie: sessionValue, csrfToken: csrfValue };
}

async function upgradeToPro(sessionCookie, csrfToken) {
  const headers = authHeaders(sessionCookie, csrfToken);
  const response = await fetch(`${API_URL}/billing/checkout/stub?tier=pro`, {
    method: "POST",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Stub checkout failed: ${response.status}`);
  }
}

function authHeaders(sessionCookie, csrfToken) {
  return {
    "Content-Type": "application/json",
    Cookie: `trainforge_session=${sessionCookie}; trainforge_csrf=${csrfToken}`,
    "X-CSRF-Token": csrfToken,
  };
}

async function runBatch(label, fn, count) {
  const started = performance.now();
  const results = await Promise.all(
    Array.from({ length: count }, () =>
      fn().then(
        (ms) => ({ ok: true, ms }),
        (error) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      ),
    ),
  );
  const elapsed = performance.now() - started;
  const ok = results.filter((r) => r.ok).length;
  const avgMs =
    results.filter((r) => r.ok && "ms" in r).reduce((sum, r) => sum + (r.ms ?? 0), 0) / Math.max(ok, 1);

  console.log(
    JSON.stringify({
      label,
      total: count,
      ok,
      failed: count - ok,
      elapsedMs: Math.round(elapsed),
      avgMs: Math.round(avgMs),
    }),
  );

  return ok === count;
}

async function main() {
  const creds =
    SESSION_COOKIE && CSRF_TOKEN
      ? { sessionCookie: SESSION_COOKIE, csrfToken: CSRF_TOKEN }
      : await registerTestUser();

  if (!SESSION_COOKIE) {
    await upgradeToPro(creds.sessionCookie, creds.csrfToken);
  }

  const headers = authHeaders(creds.sessionCookie, creds.csrfToken);

  const planOk = await runBatch(
    "plan-generate",
    async () => {
      const start = performance.now();
      const response = await fetch(`${API_URL}/plans/generate`, { method: "POST", headers });
      if (!response.ok) {
        throw new Error(`Plan generate failed: ${response.status}`);
      }
      return performance.now() - start;
    },
    ITERATIONS,
  );

  const sessionResponse = await fetch(`${API_URL}/chat/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: "Load test" }),
  });
  if (!sessionResponse.ok) {
    throw new Error(`Chat session create failed: ${sessionResponse.status}`);
  }
  const { session } = (await sessionResponse.json()) as { session: { id: string } };

  const chatOk = await runBatch(
    "chat-stream",
    async () => {
      const start = performance.now();
      const response = await fetch(`${API_URL}/chat/sessions/${session.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: "Quick form check for squats?" }),
      });
      if (!response.ok) {
        throw new Error(`Chat message failed: ${response.status}`);
      }
      await response.text();
      return performance.now() - start;
    },
    Math.min(ITERATIONS, CONCURRENCY),
  );

  if (!planOk || !chatOk) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
