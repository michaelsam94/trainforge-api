import type {
  OAuthTokens,
  WearableConnection,
  WearableMetric,
  WearableProviderId,
} from "@/domain/wearable";

export interface IWearableConnectionRepository {
  findByUserAndProvider(
    userId: string,
    provider: WearableProviderId,
  ): Promise<WearableConnection | null>;
  upsert(connection: WearableConnection): Promise<WearableConnection>;
  listByUserId(userId: string): Promise<WearableConnection[]>;
  listDueForSync(limit?: number): Promise<WearableConnection[]>;
  updateLastSynced(connectionId: string, syncedAt: string): Promise<void>;
}

export interface IWearableMetricRepository {
  upsertMetrics(userId: string, metrics: WearableMetric[]): Promise<void>;
  listRecent(userId: string, days?: number): Promise<WearableMetric[]>;
  pruneOlderThan(userId: string, retentionDays: number): Promise<void>;
}

export interface IWearableProvider {
  readonly providerId: WearableProviderId;
  getAuthorizationUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  fetchMetrics(accessToken: string, sinceDate: string): Promise<WearableMetric[]>;
  isStubMode(): boolean;
}

export interface IOAuthStateStore {
  save(state: string, payload: { userId: string; provider: WearableProviderId }): Promise<void>;
  consume(state: string): Promise<{ userId: string; provider: WearableProviderId } | null>;
}
