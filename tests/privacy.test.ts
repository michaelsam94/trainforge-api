import { describe, expect, it } from "vitest";
import { createApp } from "@/presentation/app";
import { DeleteAccountUseCase } from "@/application/use-cases/DeleteAccountUseCase";
import { RegisterUserUseCase } from "@/application/use-cases/RegisterUserUseCase";
import { WebCryptoPasswordHasher } from "@/infrastructure/auth/WebCryptoPasswordHasher";
import {
  createUserId,
  type CreateUserInput,
  type User,
  type UserId,
} from "@/domain/user";
import type { IUserRepository, ISessionRepository } from "@/application/ports";
import { isOk } from "@/domain/shared/result";

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

const testEnv: Env = {
  ENVIRONMENT: "test",
  DB: {} as D1Database,
  CACHE: {} as KVNamespace,
  MEDIA: {} as R2Bucket,
};

describe("DeleteAccountUseCase", () => {
  it("deletes user and sessions", async () => {
    const users = new MemoryUserRepository();
    const sessions = new MemorySessionRepository();
    const hasher = new WebCryptoPasswordHasher();
    const register = new RegisterUserUseCase(users, sessions, hasher);
    const deleteAccount = new DeleteAccountUseCase(users, sessions);

    const registered = await register.execute({
      email: "delete-me@trainforge.test",
      password: "password123",
      displayName: "Delete Me",
    });
    expect(isOk(registered)).toBe(true);
    if (!isOk(registered)) return;

    const result = await deleteAccount.execute(registered.value.user.id);
    expect(isOk(result)).toBe(true);

    expect(await users.findById(registered.value.user.id)).toBeNull();
    expect(await sessions.findById(registered.value.sessionId)).toBeNull();
  });
});

describe("account deletion HTTP", () => {
  it("returns 401 without session when CSRF is valid", async () => {
    const app = createApp();
    const response = await app.request(
      "/auth/account",
      {
        method: "DELETE",
        headers: {
          Cookie: "trainforge_csrf=test-token",
          "X-CSRF-Token": "test-token",
        },
      },
      testEnv,
    );
    expect(response.status).toBe(401);
  });
});
