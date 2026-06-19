import {
  CONSENT_VERSION,
  DEFAULT_RETENTION_DAYS,
  deriveRecoverySignals,
  type RecoverySignals,
  type WearableConnection,
  type WearableMetric,
  type WearableProviderId,
} from "@/domain/wearable";
import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import type {
  IOAuthStateStore,
  IWearableConnectionRepository,
  IWearableMetricRepository,
  IWearableProvider,
} from "@/application/ports/wearable";

export class ConnectWearableUseCase {
  constructor(
    private readonly oauthState: IOAuthStateStore,
    private readonly providers: Record<WearableProviderId, IWearableProvider>,
  ) {}

  async startConnect(
    userId: string,
    provider: WearableProviderId,
    redirectUri: string,
  ): Promise<Result<{ authorizationUrl: string }, DomainError>> {
    const wearableProvider = this.providers[provider];

    if (provider !== "fitbit" && wearableProvider.isStubMode()) {
      return err(DomainError.validation(`${provider} connect is not available yet`));
    }

    const state = crypto.randomUUID();
    await this.oauthState.save(state, { userId, provider });
    const authorizationUrl = wearableProvider.getAuthorizationUrl(state, redirectUri);
    return ok({ authorizationUrl });
  }

  async handleCallback(
    code: string,
    state: string,
    redirectUri: string,
    connections: IWearableConnectionRepository,
  ): Promise<Result<{ userId: string; provider: WearableProviderId }, DomainError>> {
    const payload = await this.oauthState.consume(state);
    if (!payload) {
      return err(DomainError.validation("Invalid or expired OAuth state"));
    }

    const provider = this.providers[payload.provider];
    const tokens = await provider.exchangeCode(code, redirectUri);
    const existing = await connections.findByUserAndProvider(payload.userId, payload.provider);
    const now = new Date().toISOString();

    await connections.upsert({
      id: existing?.id ?? crypto.randomUUID(),
      userId: payload.userId,
      provider: payload.provider,
      externalUserId: tokens.externalUserId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      consentGrantedAt: existing?.consentGrantedAt ?? now,
      consentVersion: CONSENT_VERSION,
      dataRetentionDays: existing?.dataRetentionDays ?? DEFAULT_RETENTION_DAYS,
      status: "connected",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    return ok({ userId: payload.userId, provider: payload.provider });
  }
}

export class SyncWearableMetricsUseCase {
  constructor(
    private readonly connections: IWearableConnectionRepository,
    private readonly metrics: IWearableMetricRepository,
    private readonly providers: Record<WearableProviderId, IWearableProvider>,
  ) {}

  async syncUser(
    userId: string,
    providerId: WearableProviderId = "fitbit",
  ): Promise<Result<{ synced: number }, DomainError>> {
    const connection = await this.connections.findByUserAndProvider(userId, providerId);
    if (!connection || connection.status !== "connected") {
      return err(DomainError.notFound("wearable connection"));
    }

    const synced = await this.syncConnection(connection);
    return ok({ synced: synced.length });
  }

  async syncAllDue(): Promise<number> {
    const due = await this.connections.listDueForSync();
    let total = 0;

    for (const connection of due) {
      const synced = await this.syncConnection(connection);
      total += synced.length;
    }

    return total;
  }

  private async syncConnection(connection: WearableConnection): Promise<WearableMetric[]> {
    const provider = this.providers[connection.provider];
    let accessToken = connection.accessToken;

    if (
      connection.tokenExpiresAt &&
      new Date(connection.tokenExpiresAt).getTime() <= Date.now() &&
      connection.refreshToken
    ) {
      const refreshed = await provider.refreshTokens(connection.refreshToken);
      accessToken = refreshed.accessToken;
      const now = new Date().toISOString();
      await this.connections.upsert({
        ...connection,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? connection.refreshToken,
        tokenExpiresAt: refreshed.expiresAt,
        updatedAt: now,
      });
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const fetched = await provider.fetchMetrics(accessToken, since.toISOString().slice(0, 10));
    await this.metrics.upsertMetrics(connection.userId, fetched);
    await this.metrics.pruneOlderThan(connection.userId, connection.dataRetentionDays);

    const syncedAt = new Date().toISOString();
    await this.connections.updateLastSynced(connection.id, syncedAt);

    return fetched;
  }
}

export class GetRecoverySignalsUseCase {
  constructor(private readonly metrics: IWearableMetricRepository) {}

  async execute(userId: string): Promise<Result<RecoverySignals, DomainError>> {
    const recent = await this.metrics.listRecent(userId, 7);
    return ok(deriveRecoverySignals(recent));
  }
}

export class GetWearableMetricsUseCase {
  constructor(
    private readonly connections: IWearableConnectionRepository,
    private readonly metrics: IWearableMetricRepository,
  ) {}

  async execute(userId: string): Promise<
    Result<
      {
        connections: WearableConnection[];
        metrics: WearableMetric[];
        recovery: RecoverySignals;
      },
      DomainError
    >
  > {
    const [connections, metrics] = await Promise.all([
      this.connections.listByUserId(userId),
      this.metrics.listRecent(userId, 7),
    ]);

    return ok({
      connections,
      metrics,
      recovery: deriveRecoverySignals(metrics),
    });
  }
}
