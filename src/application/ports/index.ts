import type { CreateUserInput, User, UserId, UserWithMeta } from "@/domain/user";
import type { OnboardingDraft, OnboardingProfile } from "@/domain/user";

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<(User & { passwordHash: string }) | null>;
  create(input: CreateUserInput): Promise<User>;
  deleteById(id: UserId): Promise<void>;
}

export interface IOnboardingRepository {
  findByUserId(userId: UserId): Promise<OnboardingProfile | null>;
  saveDraft(userId: UserId, draft: OnboardingDraft): Promise<OnboardingProfile>;
  markComplete(userId: UserId): Promise<OnboardingProfile>;
}

export interface ISessionRepository {
  create(userId: UserId, expiresAt: Date): Promise<string>;
  findById(sessionId: string): Promise<{ userId: UserId; expiresAt: Date } | null>;
  deleteById(sessionId: string): Promise<void>;
  deleteByUserId(userId: UserId): Promise<void>;
}

export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

export interface IUserReader {
  getById(id: UserId): Promise<UserWithMeta | null>;
}
