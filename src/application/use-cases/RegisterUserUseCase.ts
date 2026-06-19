import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import {
  createUserId,
  normalizeEmail,
  type UserWithMeta,
} from "@/domain/user";
import type {
  IPasswordHasher,
  ISessionRepository,
  IUserRepository,
} from "@/application/ports";

export type RegisterUserInput = {
  email: string;
  password: string;
  displayName: string;
};

export type AuthSessionResult = {
  user: UserWithMeta;
  sessionId: string;
  csrfToken: string;
};

const MIN_PASSWORD_LENGTH = 8;

export class RegisterUserUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly sessions: ISessionRepository,
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: RegisterUserInput): Promise<Result<AuthSessionResult, DomainError>> {
    const email = normalizeEmail(input.email);
    const displayName = input.displayName.trim();

    if (!email.includes("@")) {
      return err(DomainError.validation("A valid email is required"));
    }

    if (input.password.length < MIN_PASSWORD_LENGTH) {
      return err(
        DomainError.validation(`Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters`),
      );
    }

    if (displayName.length < 2) {
      return err(DomainError.validation("Name must be at least 2 characters"));
    }

    const existing = await this.users.findByEmail(email);
    if (existing) {
      return err(DomainError.validation("An account with this email already exists"));
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.create({ email, displayName, passwordHash });

    const sessionId = await this.createSession(user.id);
    const csrfToken = crypto.randomUUID();

    return ok({
      user: {
        ...user,
        onboardingCompleted: false,
        subscriptionTier: "free",
      },
      sessionId,
      csrfToken,
    });
  }

  private async createSession(userId: ReturnType<typeof createUserId>): Promise<string> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.sessions.create(userId, expiresAt);
  }
}
