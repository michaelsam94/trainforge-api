import { ok, type Result } from "@/domain/shared/result";
import type { ISessionRepository } from "@/application/ports";

export class LogoutUserUseCase {
  constructor(private readonly sessions: ISessionRepository) {}

  async execute(sessionId: string | undefined): Promise<Result<void, never>> {
    if (sessionId) {
      await this.sessions.deleteById(sessionId);
    }
    return ok(undefined);
  }
}
