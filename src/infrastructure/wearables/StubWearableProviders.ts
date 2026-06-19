import type { IWearableProvider } from "@/application/ports/wearable";
import type { OAuthTokens, WearableMetric } from "@/domain/wearable";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export class StubGarminProvider implements IWearableProvider {
  readonly providerId = "garmin" as const;

  isStubMode(): boolean {
    return true;
  }

  getAuthorizationUrl(): string {
    throw new Error("Garmin connect is not available yet");
  }

  exchangeCode(): Promise<OAuthTokens> {
    return Promise.reject(new Error("Garmin connect is not available yet"));
  }

  refreshTokens(): Promise<OAuthTokens> {
    return Promise.reject(new Error("Garmin connect is not available yet"));
  }

  fetchMetrics(): Promise<WearableMetric[]> {
    return Promise.resolve([]);
  }
}

export class StubAppleHealthProvider implements IWearableProvider {
  readonly providerId = "apple_health" as const;

  isStubMode(): boolean {
    return true;
  }

  getAuthorizationUrl(): string {
    throw new Error("Apple Health connect is not available yet");
  }

  exchangeCode(): Promise<OAuthTokens> {
    return Promise.reject(new Error("Apple Health connect is not available yet"));
  }

  refreshTokens(): Promise<OAuthTokens> {
    return Promise.reject(new Error("Apple Health connect is not available yet"));
  }

  fetchMetrics(): Promise<WearableMetric[]> {
    return Promise.resolve([]);
  }
}

export function buildStubFitbitMetrics(): WearableMetric[] {
  const date = yesterdayIso();
  return [
    {
      provider: "fitbit",
      type: "sleep_minutes",
      value: 330,
      unit: "minutes",
      recordedAt: `${date}T08:00:00.000Z`,
    },
    {
      provider: "fitbit",
      type: "resting_hr",
      value: 62,
      unit: "bpm",
      recordedAt: `${date}T08:00:00.000Z`,
    },
    {
      provider: "fitbit",
      type: "hrv_ms",
      value: 48,
      unit: "ms",
      recordedAt: `${date}T08:00:00.000Z`,
    },
    {
      provider: "fitbit",
      type: "steps",
      value: 7200,
      unit: "count",
      recordedAt: `${todayIso()}T12:00:00.000Z`,
    },
  ];
}
