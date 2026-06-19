type ErrorReportContext = {
  requestId?: string;
  route?: string;
  code?: string;
  environment?: string;
};

type ParsedSentryDsn = {
  host: string;
  projectId: string;
  publicKey: string;
};

function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    const publicKey = url.username;
    if (!projectId || !publicKey) return null;
    return { host: url.host, projectId, publicKey };
  } catch {
    return null;
  }
}

export class ErrorReporter {
  constructor(private readonly dsn?: string) {}

  report(error: Error, context: ErrorReportContext = {}): void {
    const payload = {
      level: "error",
      message: error.message,
      requestId: context.requestId,
      route: context.route,
      code: context.code ?? "INTERNAL",
      environment: context.environment ?? "unknown",
      timestamp: new Date().toISOString(),
    };

    console.error(JSON.stringify(payload));

    if (!this.dsn) return;

    const parsed = parseSentryDsn(this.dsn);
    if (!parsed) return;

    void fetch(`https://${parsed.host}/api/${parsed.projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7,sentry_key=${parsed.publicKey}`,
      },
      body: JSON.stringify({
        message: error.message,
        level: "error",
        tags: {
          requestId: context.requestId,
          route: context.route,
          code: context.code,
        },
        extra: {
          environment: context.environment,
        },
      }),
    }).catch(() => {
      // Never throw from observability path.
    });
  }
}

export function createErrorReporter(env: Env): ErrorReporter {
  return new ErrorReporter(env.SENTRY_DSN);
}
