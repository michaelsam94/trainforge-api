export type WearableProviderId = "fitbit" | "garmin" | "apple_health";

export type WearableMetricType =
  | "sleep_minutes"
  | "resting_hr"
  | "hrv_ms"
  | "steps";

export type WearableMetric = {
  provider: WearableProviderId;
  type: WearableMetricType;
  value: number;
  unit: string;
  recordedAt: string;
};

export type WearableConnection = {
  id: string;
  userId: string;
  provider: WearableProviderId;
  externalUserId?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  scopes?: string;
  consentGrantedAt: string;
  consentVersion: string;
  dataRetentionDays: number;
  lastSyncedAt?: string;
  status: "connected" | "disconnected" | "error";
  createdAt: string;
  updatedAt: string;
};

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  externalUserId?: string;
  scopes?: string;
};

export const CONSENT_VERSION = "1.0";
export const DEFAULT_RETENTION_DAYS = 90;
