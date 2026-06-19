import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { normalizeEmail } from "@/domain/user";
import type {
  IPasswordHasher,
  ISessionRepository,
  IUserRepository,
  IOnboardingRepository,
} from "@/application/ports";
import type { AuthSessionResult } from "./RegisterUserUseCase";
import { isOnboardingComplete } from "@/domain/user";

export type LoginUserInput = {
  email: string;
  password: string;
};

export class LoginUserUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly sessions: ISessionRepository,
    private readonly onboarding: IOnboardingRepository,
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: LoginUserInput): Promise<Result<AuthSessionResult, DomainError>> {
    const email = normalizeEmail(input.email);
    const record = await this.users.findByEmail(email);

    if (!record) {
      return err(DomainError.unauthorized("Invalid email or password"));
    }

    const valid = await this.passwordHasher.verify(input.password, record.passwordHash);
    if (!valid) {
      return err(DomainError.unauthorized("Invalid email or password"));
    }

    const profile = await this.onboarding.findByUserId(record.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionId = await this.sessions.create(record.id, expiresAt);
    const csrfToken = crypto.randomUUID();

    const { passwordHash: _hash, ...user } = record;
    void _hash;

    return ok({
      user: {
        ...user,
        onboardingCompleted: isOnboardingComplete(profile),
        subscriptionTier: "free",
      },
      sessionId,
      csrfToken,
    });
  }
}
