export type UserId = string & { readonly brand: unique symbol };

export type User = {
  id: UserId;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type UserWithMeta = User & {
  onboardingCompleted: boolean;
  subscriptionTier: import("@/domain/billing").SubscriptionTier;
};

export type CreateUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
};

export function createUserId(id: string): UserId {
  return id as UserId;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
