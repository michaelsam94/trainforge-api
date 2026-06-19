import { Hono } from "hono";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";
import { requireFeature } from "@/presentation/middleware/require-feature";

export const wearableRoutes = new Hono<{ Bindings: Env }>();

wearableRoutes.get("/status", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.getWearableMetrics.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({
    connections: result.value.connections.map(toConnectionDto),
  });
});

wearableRoutes.get("/metrics", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.getWearableMetrics.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({
    metrics: result.value.metrics.map(toMetricDto),
    recovery: result.value.recovery,
    connections: result.value.connections.map(toConnectionDto),
  });
});

wearableRoutes.get("/connect/fitbit", requireAuth(), requireFeature("wearables"), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const redirectUri = `${getApiOrigin(c)}/wearables/callback/fitbit`;
  const result = await container.connectWearable.startConnect(user.id, "fitbit", redirectUri);

  if (isErr(result)) {
    throw result.error;
  }

  return c.redirect(result.value.authorizationUrl, 302);
});

wearableRoutes.get("/callback/fitbit", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.redirect(`${getAppOrigin(c)}/profile?wearable=error`, 302);
  }

  const container = c.get("container");
  const redirectUri = `${getApiOrigin(c)}/wearables/callback/fitbit`;
  const result = await container.connectWearable.handleCallback(
    code,
    state,
    redirectUri,
    container.wearableConnections,
  );

  if (isErr(result)) {
    return c.redirect(`${getAppOrigin(c)}/profile?wearable=error`, 302);
  }

  await container.syncWearableMetrics.syncUser(result.value.userId, "fitbit");
  return c.redirect(`${getAppOrigin(c)}/progress?wearable=connected`, 302);
});

wearableRoutes.post("/sync", requireAuth(), requireFeature("wearables"), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.syncWearableMetrics.syncUser(user.id, "fitbit");

  if (isErr(result)) {
    throw result.error;
  }

  return c.json(result.value);
});

function getApiOrigin(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

function getAppOrigin(c: { env: Env }): string {
  return c.env.APP_URL ?? "http://localhost:2021";
}

function toConnectionDto(connection: import("@/domain/wearable").WearableConnection) {
  return {
    id: connection.id,
    provider: connection.provider,
    status: connection.status,
    consentGrantedAt: connection.consentGrantedAt,
    consentVersion: connection.consentVersion,
    dataRetentionDays: connection.dataRetentionDays,
    lastSyncedAt: connection.lastSyncedAt,
  };
}

function toMetricDto(metric: import("@/domain/wearable").WearableMetric) {
  return {
    provider: metric.provider,
    type: metric.type,
    value: metric.value,
    unit: metric.unit,
    recordedAt: metric.recordedAt,
  };
}
