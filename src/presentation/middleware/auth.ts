import type { Context, Next } from "hono";
import { DomainError } from "@/domain/shared/errors";
import { isErr } from "@/domain/shared/result";
import type { GetCurrentUserUseCase } from "@/application/use-cases/GetCurrentUserUseCase";
import { getSessionId } from "@/infrastructure/auth/sessionCookies";
import type { UserWithMeta } from "@/domain/user";

declare module "hono" {
  interface ContextVariableMap {
    currentUser: UserWithMeta;
  }
}

export function createAuthMiddleware(getCurrentUser: GetCurrentUserUseCase) {
  return async (c: Context, next: Next) => {
    const sessionId = getSessionId(c);
    const result = await getCurrentUser.execute(sessionId);

    if (isErr(result)) {
      throw DomainError.unauthorized();
    }

    c.set("currentUser", result.value);
    return next();
  };
}
