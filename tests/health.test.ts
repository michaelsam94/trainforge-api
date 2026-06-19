import { describe, expect, it } from "vitest";
import { createApp } from "@/presentation/app";

describe("GET /health", () => {
  it("returns ok status", async () => {
    const app = createApp();
    const response = await app.request("/health", {}, {
      ENVIRONMENT: "test",
      DB: {} as D1Database,
      CACHE: {} as KVNamespace,
      MEDIA: {} as R2Bucket,
    });

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      status: string;
      service: string;
      environment: string;
    };

    expect(body.status).toBe("ok");
    expect(body.service).toBe("trainforge-api");
    expect(body.environment).toBe("test");
  });
});

describe("unknown route", () => {
  it("returns 404 with normalized error shape", async () => {
    const app = createApp();
    const response = await app.request("/unknown", {}, {
      ENVIRONMENT: "test",
      DB: {} as D1Database,
      CACHE: {} as KVNamespace,
      MEDIA: {} as R2Bucket,
    });

    expect(response.status).toBe(404);

    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(body.error.code).toBe("NOT_FOUND");
  });
});
