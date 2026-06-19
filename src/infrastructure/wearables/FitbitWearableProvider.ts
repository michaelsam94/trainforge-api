import type { IWearableProvider } from "@/application/ports/wearable";
import type { OAuthTokens, WearableMetric } from "@/domain/wearable";
import { buildStubFitbitMetrics } from "@/infrastructure/wearables/StubWearableProviders";

type FitbitSleepResponse = {
  sleep?: { minutesAsleep?: number; dateOfSleep?: string }[];
};

type FitbitHeartRateResponse = {
  "activities-heart"?: { value?: { restingHeartRate?: number; date?: string } }[];
};

type FitbitActivityResponse = {
  "activities-steps"?: { value?: string; dateTime?: string }[];
};

export class FitbitWearableProvider implements IWearableProvider {
  readonly providerId = "fitbit" as const;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  isStubMode(): boolean {
    return !this.clientId || !this.clientSecret;
  }

  getAuthorizationUrl(state: string, redirectUri: string): string {
    if (this.isStubMode()) {
      return `${redirectUri}?code=stub-fitbit-code&state=${encodeURIComponent(state)}`;
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: "activity sleep heartrate profile",
      state,
    });

    return `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (this.isStubMode() || code === "stub-fitbit-code") {
      return {
        accessToken: `stub-access-${crypto.randomUUID()}`,
        refreshToken: `stub-refresh-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        externalUserId: "stub-fitbit-user",
        scopes: "activity sleep heartrate profile",
      };
    }

    return this.requestTokens({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    if (this.isStubMode() || refreshToken.startsWith("stub-refresh-")) {
      return {
        accessToken: `stub-access-${crypto.randomUUID()}`,
        refreshToken,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        externalUserId: "stub-fitbit-user",
        scopes: "activity sleep heartrate profile",
      };
    }

    return this.requestTokens({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  async fetchMetrics(accessToken: string, sinceDate: string): Promise<WearableMetric[]> {
    if (this.isStubMode() || accessToken.startsWith("stub-access-")) {
      return buildStubFitbitMetrics();
    }

    const metrics: WearableMetric[] = [];
    const sleep = await this.fetchJson<FitbitSleepResponse>(
      accessToken,
      `https://api.fitbit.com/1.2/user/-/sleep/list.json?afterDate=${sinceDate}&sort=desc&limit=1`,
    );

    const sleepEntry = sleep.sleep?.[0];
    if (sleepEntry?.minutesAsleep && sleepEntry.dateOfSleep) {
      metrics.push({
        provider: "fitbit",
        type: "sleep_minutes",
        value: sleepEntry.minutesAsleep,
        unit: "minutes",
        recordedAt: `${sleepEntry.dateOfSleep}T08:00:00.000Z`,
      });
    }

    const heart = await this.fetchJson<FitbitHeartRateResponse>(
      accessToken,
      `https://api.fitbit.com/1/user/-/activities/heart/date/${sinceDate}/1d.json`,
    );
    const resting = heart["activities-heart"]?.[0]?.value?.restingHeartRate;
    const heartDate = heart["activities-heart"]?.[0]?.value?.date ?? sinceDate;
    if (resting) {
      metrics.push({
        provider: "fitbit",
        type: "resting_hr",
        value: resting,
        unit: "bpm",
        recordedAt: `${heartDate}T08:00:00.000Z`,
      });
    }

    const activity = await this.fetchJson<FitbitActivityResponse>(
      accessToken,
      `https://api.fitbit.com/1/user/-/activities/steps/date/${sinceDate}/7d.json`,
    );

    for (const entry of activity["activities-steps"] ?? []) {
      if (!entry.dateTime || !entry.value) continue;
      metrics.push({
        provider: "fitbit",
        type: "steps",
        value: Number(entry.value),
        unit: "count",
        recordedAt: `${entry.dateTime}T12:00:00.000Z`,
      });
    }

    return metrics;
  }

  private async requestTokens(body: Record<string, string>): Promise<OAuthTokens> {
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    const response = await fetch("https://api.fitbit.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      throw new Error("Fitbit token exchange failed");
    }

    const payload: {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      user_id?: string;
      scope?: string;
    } = await response.json();

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: payload.expires_in
        ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
        : undefined,
      externalUserId: payload.user_id,
      scopes: payload.scope,
    };
  }

  private async fetchJson<T>(accessToken: string, url: string): Promise<T> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Fitbit API request failed: ${url}`);
    }

    const payload = (await response.json()) as T;
    return payload;
  }
}
