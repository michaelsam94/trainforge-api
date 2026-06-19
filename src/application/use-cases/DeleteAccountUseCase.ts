import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import type { IUserRepository, ISessionRepository } from "@/application/ports";
import type { UserId } from "@/domain/user";

export class DeleteAccountUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly sessions: ISessionRepository,
  ) {}

  async execute(userId: UserId): Promise<Result<{ deleted: true }, DomainError>> {
    const user = await this.users.findById(userId);
    if (!user) {
      return err(DomainError.notFound("user"));
    }

    await this.sessions.deleteByUserId(userId);
    await this.users.deleteById(userId);

    return ok({ deleted: true });
  }
}
