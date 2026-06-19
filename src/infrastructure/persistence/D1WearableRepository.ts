import type {
  WearableConnection,
  WearableMetric,
  WearableProviderId,
} from "@/domain/wearable";
import type {
  IWearableConnectionRepository,
  IWearableMetricRepository,
} from "@/application/ports/wearable";

type ConnectionRow = {
  id: string;
  user_id: string;
  provider: WearableProviderId;
  external_user_id: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string | null;
  consent_granted_at: string;
  consent_version: string;
  data_retention_days: number;
  last_synced_at: string | null;
  status: WearableConnection["status"];
  created_at: string;
  updated_at: string;
};

type MetricRow = {
  id: string;
  user_id: string;
  provider: WearableProviderId;
  metric_type: WearableMetric["type"];
  value: number;
  unit: string;
  recorded_date: string;
  synced_at: string;
};

function mapConnection(row: ConnectionRow): WearableConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    externalUserId: row.external_user_id ?? undefined,
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? undefined,
    tokenExpiresAt: row.token_expires_at ?? undefined,
    scopes: row.scopes ?? undefined,
    consentGrantedAt: row.consent_granted_at,
    consentVersion: row.consent_version,
    dataRetentionDays: row.data_retention_days,
    lastSyncedAt: row.last_synced_at ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1WearableConnectionRepository implements IWearableConnectionRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserAndProvider(userId: string, provider: WearableProviderId) {
    const row = await this.db
      .prepare(
        `SELECT id, user_id, provider, external_user_id, access_token, refresh_token, token_expires_at,
                scopes, consent_granted_at, consent_version, data_retention_days, last_synced_at,
                status, created_at, updated_at
         FROM wearable_connections WHERE user_id = ? AND provider = ?`,
      )
      .bind(userId, provider)
      .first<ConnectionRow>();

    return row ? mapConnection(row) : null;
  }

  async upsert(connection: WearableConnection) {
    await this.db
      .prepare(
        `INSERT INTO wearable_connections (
           id, user_id, provider, external_user_id, access_token, refresh_token, token_expires_at,
           scopes, consent_granted_at, consent_version, data_retention_days, last_synced_at,
           status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, provider) DO UPDATE SET
           external_user_id = excluded.external_user_id,
           access_token = excluded.access_token,
           refresh_token = excluded.refresh_token,
           token_expires_at = excluded.token_expires_at,
           scopes = excluded.scopes,
           consent_granted_at = excluded.consent_granted_at,
           consent_version = excluded.consent_version,
           data_retention_days = excluded.data_retention_days,
           last_synced_at = excluded.last_synced_at,
           status = excluded.status,
           updated_at = excluded.updated_at`,
      )
      .bind(
        connection.id,
        connection.userId,
        connection.provider,
        connection.externalUserId ?? null,
        connection.accessToken,
        connection.refreshToken ?? null,
        connection.tokenExpiresAt ?? null,
        connection.scopes ?? null,
        connection.consentGrantedAt,
        connection.consentVersion,
        connection.dataRetentionDays,
        connection.lastSyncedAt ?? null,
        connection.status,
        connection.createdAt,
        connection.updatedAt,
      )
      .run();

    const saved = await this.findByUserAndProvider(connection.userId, connection.provider);
    if (!saved) throw new Error("Failed to save wearable connection");
    return saved;
  }

  async listByUserId(userId: string) {
    const result = await this.db
      .prepare(
        `SELECT id, user_id, provider, external_user_id, access_token, refresh_token, token_expires_at,
                scopes, consent_granted_at, consent_version, data_retention_days, last_synced_at,
                status, created_at, updated_at
         FROM wearable_connections WHERE user_id = ? ORDER BY updated_at DESC`,
      )
      .bind(userId)
      .all<ConnectionRow>();

    return result.results.map(mapConnection);
  }

  async listDueForSync(limit = 50) {
    const result = await this.db
      .prepare(
        `SELECT id, user_id, provider, external_user_id, access_token, refresh_token, token_expires_at,
                scopes, consent_granted_at, consent_version, data_retention_days, last_synced_at,
                status, created_at, updated_at
         FROM wearable_connections
         WHERE status = 'connected'
           AND (last_synced_at IS NULL OR last_synced_at < datetime('now', '-6 hours'))
         ORDER BY COALESCE(last_synced_at, '1970-01-01') ASC
         LIMIT ?`,
      )
      .bind(limit)
      .all<ConnectionRow>();

    return result.results.map(mapConnection);
  }

  async updateLastSynced(connectionId: string, syncedAt: string) {
    await this.db
      .prepare(
        `UPDATE wearable_connections SET last_synced_at = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(syncedAt, syncedAt, connectionId)
      .run();
  }
}

export class D1WearableMetricRepository implements IWearableMetricRepository {
  constructor(private readonly db: D1Database) {}

  async upsertMetrics(userId: string, metrics: WearableMetric[]) {
    for (const metric of metrics) {
      await this.db
        .prepare(
          `INSERT INTO wearable_metrics (id, user_id, provider, metric_type, value, unit, recorded_date, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, provider, metric_type, recorded_date) DO UPDATE SET
             value = excluded.value,
             unit = excluded.unit,
             synced_at = excluded.synced_at`,
        )
        .bind(
          crypto.randomUUID(),
          userId,
          metric.provider,
          metric.type,
          metric.value,
          metric.unit,
          metric.recordedAt.slice(0, 10),
          new Date().toISOString(),
        )
        .run();
    }
  }

  async listRecent(userId: string, days = 7) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceDate = since.toISOString().slice(0, 10);

    const result = await this.db
      .prepare(
        `SELECT id, user_id, provider, metric_type, value, unit, recorded_date, synced_at
         FROM wearable_metrics
         WHERE user_id = ? AND recorded_date >= ?
         ORDER BY recorded_date DESC`,
      )
      .bind(userId, sinceDate)
      .all<MetricRow>();

    return result.results.map((row) => ({
      provider: row.provider,
      type: row.metric_type,
      value: row.value,
      unit: row.unit,
      recordedAt: `${row.recorded_date}T12:00:00.000Z`,
    }));
  }

  async pruneOlderThan(userId: string, retentionDays: number) {
    await this.db
      .prepare(
        `DELETE FROM wearable_metrics
         WHERE user_id = ?
           AND recorded_date < date('now', ?)`,
      )
      .bind(userId, `-${String(retentionDays)} days`)
      .run();
  }
}
