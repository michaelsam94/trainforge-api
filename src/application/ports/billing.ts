import type {
  Subscription,
  SubscriptionStatus,
  SubscriptionTier,
} from "@/domain/billing";
import type { UserId } from "@/domain/user";

export interface ISubscriptionRepository {
  findByUserId(userId: UserId): Promise<Subscription | null>;
  findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null>;
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null>;
  upsert(input: {
    userId: UserId;
    tier: SubscriptionTier;
    status?: SubscriptionStatus;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: string | null;
  }): Promise<Subscription>;
}

export interface IUserBillingRepository {
  getStripeCustomerId(userId: UserId): Promise<string | null>;
  setStripeCustomerId(userId: UserId, stripeCustomerId: string): Promise<void>;
  findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<UserId | null>;
}

export type CheckoutTier = "pro" | "premium";

export type CheckoutSessionResult = {
  url: string;
  sessionId: string;
};

export type PortalSessionResult = {
  url: string;
};

export interface IBillingClient {
  isConfigured(): boolean;
  createCheckoutSession(input: {
    userId: string;
    email: string;
    tier: CheckoutTier;
    stripeCustomerId?: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult>;
  createPortalSession(input: {
    stripeCustomerId: string;
    returnUrl: string;
  }): Promise<PortalSessionResult>;
  verifyWebhookSignature(payload: string, signature: string | undefined): Promise<boolean>;
  parseWebhookEvent(payload: string): StripeWebhookEvent;
  tierFromPriceId(priceId: string): CheckoutTier | null;
}

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};
