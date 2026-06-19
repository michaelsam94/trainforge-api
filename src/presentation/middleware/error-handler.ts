import type { Context } from "hono";
import { DomainError } from "@/domain/shared/errors";
import { createErrorReporter } from "@/infrastructure/observability/errorReporter";

export function errorHandler(err: Error, c: Context<{ Bindings: Env }>): Response {
  const requestId = c.get("requestId");

  if (err instanceof DomainError) {
    const status = domainErrorToStatus(err.code);
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          requestId,
        },
      },
      status,
    );
  }

  createErrorReporter(c.env).report(err, {
    requestId,
    route: new URL(c.req.url).pathname,
    code: "INTERNAL",
    environment: c.env.ENVIRONMENT,
  });

  return c.json(
    {
      error: {
        code: "INTERNAL",
        message: "An unexpected error occurred",
        requestId,
      },
    },
    500,
  );
}

function domainErrorToStatus(code: DomainError["code"]): 400 | 401 | 403 | 404 | 409 | 500 {
  switch (code) {
    case "VALIDATION":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    default:
      return 500;
  }
}
