import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { isOnboardingComplete, type UserWithMeta } from "@/domain/user";
import type {
  IOnboardingRepository,
  ISessionRepository,
  IUserRepository,
} from "@/application/ports";
import type { ISubscriptionRepository } from "@/application/ports/billing";
import { resolveSubscriptionTier } from "@/infrastructure/persistence/D1SubscriptionRepository";

export class GetCurrentUserUseCase {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly users: IUserRepository,
    private readonly onboarding: IOnboardingRepository,
    private readonly subscriptions: ISubscriptionRepository,
  ) {}

  async execute(sessionId: string | undefined): Promise<Result<UserWithMeta, DomainError>> {
    if (!sessionId) {
      return err(DomainError.unauthorized());
    }

    const session = await this.sessions.findById(sessionId);
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) {
        await this.sessions.deleteById(sessionId);
      }
      return err(DomainError.unauthorized());
    }

    const user = await this.users.findById(session.userId);
    if (!user) {
      return err(DomainError.unauthorized());
    }

    const profile = await this.onboarding.findByUserId(session.userId);
    const subscriptionTier = await resolveSubscriptionTier(this.subscriptions, session.userId);

    return ok({
      ...user,
      onboardingCompleted: isOnboardingComplete(profile),
      subscriptionTier,
    });
  }
}
