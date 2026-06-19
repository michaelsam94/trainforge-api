import { describe, expect, it } from "vitest";
import { createApp } from "@/presentation/app";
import { RegisterUserUseCase } from "@/application/use-cases/RegisterUserUseCase";
import { LoginUserUseCase } from "@/application/use-cases/LoginUserUseCase";
import { GetCurrentUserUseCase } from "@/application/use-cases/GetCurrentUserUseCase";
import { WebCryptoPasswordHasher } from "@/infrastructure/auth/WebCryptoPasswordHasher";
import {
  createUserId,
  type CreateUserInput,
  type OnboardingDraft,
  type OnboardingProfile,
  type User,
  type UserId,
} from "@/domain/user";
import type {
  IOnboardingRepository,
  ISessionRepository,
  IUserRepository,
} from "@/application/ports";
import type { ISubscriptionRepository } from "@/application/ports/billing";
import type { Subscription, SubscriptionTier } from "@/domain/billing";
import { isErr, isOk } from "@/domain/shared/result";

class MemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User & { passwordHash: string }>();

  async findById(id: UserId): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const id = createUserId(crypto.randomUUID());
    const now = new Date().toISOString();
    const user = {
      id,
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async deleteById(id: UserId): Promise<void> {
    this.users.delete(id);
  }
}

class MemorySessionRepository implements ISessionRepository {
  private readonly sessions = new Map<string, { userId: UserId; expiresAt: Date }>();

  async create(userId: UserId, expiresAt: Date): Promise<string> {
    const id = crypto.randomUUID();
    this.sessions.set(id, { userId, expiresAt });
    return id;
  }

  async findById(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  async deleteById(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteByUserId(userId: UserId): Promise<void> {
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId) this.sessions.delete(id);
    }
  }
}

class MemoryOnboardingRepository implements IOnboardingRepository {
  private readonly profiles = new Map<string, OnboardingProfile>();

  async findByUserId(userId: UserId): Promise<OnboardingProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async saveDraft(userId: UserId, draft: OnboardingDraft): Promise<OnboardingProfile> {
    const profile: OnboardingProfile = {
      userId,
      ...draft,
      completedAt: this.profiles.get(userId)?.completedAt ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(userId, profile);
    return profile;
  }

  async markComplete(userId: UserId): Promise<OnboardingProfile> {
    const existing = this.profiles.get(userId);
    const now = new Date().toISOString();
    const profile: OnboardingProfile = {
      userId,
      goals: existing?.goals ?? [],
      fitnessLevel: existing?.fitnessLevel ?? "beginner",
      equipment: existing?.equipment ?? [],
      availableDays: existing?.availableDays ?? [],
      sessionMinutes: existing?.sessionMinutes ?? 30,
      completedAt: now,
      updatedAt: now,
    };
    this.profiles.set(userId, profile);
    return profile;
  }
}

const testEnv: Env = {
  ENVIRONMENT: "test",
  DB: {} as D1Database,
  CACHE: {} as KVNamespace,
  MEDIA: {} as R2Bucket,
};

class MemorySubscriptionRepository implements ISubscriptionRepository {
  private readonly rows = new Map<string, Subscription>();

  async findByUserId(userId: UserId): Promise<Subscription | null> {
    return this.rows.get(userId) ?? null;
  }

  async findByStripeCustomerId(): Promise<Subscription | null> {
    return null;
  }

  async findByStripeSubscriptionId(): Promise<Subscription | null> {
    return null;
  }

  async upsert(input: {
    userId: UserId;
    tier: SubscriptionTier;
    status?: Subscription["status"];
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: string | null;
  }): Promise<Subscription> {
    const saved: Subscription = {
      userId: input.userId,
      tier: input.tier,
      status: input.status ?? "active",
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
      stripePriceId: input.stripePriceId ?? undefined,
      currentPeriodEnd: input.currentPeriodEnd ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    this.rows.set(input.userId, saved);
    return saved;
  }
}

describe("auth HTTP", () => {
  it("returns 401 on /auth/me without session", async () => {
    const app = createApp();
    const response = await app.request("/auth/me", {}, testEnv);
    expect(response.status).toBe(401);
  });

  it("returns 401 on /protected-demo without session", async () => {
    const app = createApp();
    const response = await app.request("/protected-demo", {}, testEnv);
    expect(response.status).toBe(401);
  });
});

describe("auth use cases", () => {
  it("registers and logs in a user", async () => {
    const users = new MemoryUserRepository();
    const sessions = new MemorySessionRepository();
    const onboarding = new MemoryOnboardingRepository();
    const hasher = new WebCryptoPasswordHasher();

    const register = new RegisterUserUseCase(users, sessions, hasher);
    const login = new LoginUserUseCase(users, sessions, onboarding, hasher);
    const getCurrent = new GetCurrentUserUseCase(sessions, users, onboarding, new MemorySubscriptionRepository());

    const registered = await register.execute({
      email: "runner@trainforge.test",
      password: "password123",
      displayName: "Alex Runner",
    });
    expect(isOk(registered)).toBe(true);
    if (!isOk(registered)) return;

    expect(registered.value.user.onboardingCompleted).toBe(false);

    const authed = await getCurrentUserFromSession(
      getCurrent,
      registered.value.sessionId,
    );
    expect(isOk(authed)).toBe(true);

    const loggedIn = await login.execute({
      email: "runner@trainforge.test",
      password: "password123",
    });
    expect(isOk(loggedIn)).toBe(true);
  });

  it("rejects invalid credentials", async () => {
    const users = new MemoryUserRepository();
    const sessions = new MemorySessionRepository();
    const onboarding = new MemoryOnboardingRepository();
    const hasher = new WebCryptoPasswordHasher();
    const register = new RegisterUserUseCase(users, sessions, hasher);
    const login = new LoginUserUseCase(users, sessions, onboarding, hasher);

    await register.execute({
      email: "runner@trainforge.test",
      password: "password123",
      displayName: "Alex Runner",
    });

    const result = await login.execute({
      email: "runner@trainforge.test",
      password: "wrong-password",
    });

    expect(isErr(result)).toBe(true);
  });
});

async function getCurrentUserFromSession(
  getCurrent: GetCurrentUserUseCase,
  sessionId: string,
) {
  return getCurrent.execute(sessionId);
}

describe("WebCryptoPasswordHasher", () => {
  it("hashes and verifies passwords", async () => {
    const hasher = new WebCryptoPasswordHasher();
    const hash = await hasher.hash("password123");
    expect(await hasher.verify("password123", hash)).toBe(true);
    expect(await hasher.verify("wrong", hash)).toBe(false);
  });
});
