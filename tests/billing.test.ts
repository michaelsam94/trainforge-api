import { describe, expect, it } from "vitest";
import {
  HandleStripeWebhookUseCase,
  CompleteStubCheckoutUseCase,
  GetSubscriptionUseCase,
} from "@/application/use-cases/BillingUseCases";
import {
  listFeaturesForTier,
  requiredTierForFeature,
  tierIncludesFeature,
} from "@/domain/billing";
import type { Subscription, SubscriptionTier } from "@/domain/billing";
import type {
  IBillingClient,
  ISubscriptionRepository,
  IUserBillingRepository,
} from "@/application/ports/billing";
import { createUserId, type UserId } from "@/domain/user";
import { isOk } from "@/domain/shared/result";

class MemorySubscriptionRepository implements ISubscriptionRepository {
  private readonly rows = new Map<string, Subscription>();

  async findByUserId(userId: UserId): Promise<Subscription | null> {
    return this.rows.get(userId) ?? null;
  }

  async findByStripeCustomerId(): Promise<Subscription | null> {
    return null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    for (const row of this.rows.values()) {
      if (row.stripeSubscriptionId === stripeSubscriptionId) return row;
    }
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

class MemoryUserBillingRepository implements IUserBillingRepository {
  private readonly customers = new Map<string, string>();

  async getStripeCustomerId(userId: UserId): Promise<string | null> {
    return this.customers.get(userId) ?? null;
  }

  async setStripeCustomerId(userId: UserId, stripeCustomerId: string): Promise<void> {
    this.customers.set(userId, stripeCustomerId);
  }

  async findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<UserId | null> {
    for (const [userId, customerId] of this.customers.entries()) {
      if (customerId === stripeCustomerId) return userId as UserId;
    }
    return null;
  }
}

class StubBillingClient implements IBillingClient {
  isConfigured(): boolean {
    return false;
  }

  async createCheckoutSession() {
    return { url: "https://example.com/checkout", sessionId: "cs_test" };
  }

  async createPortalSession() {
    return { url: "https://example.com/portal" };
  }

  async verifyWebhookSignature(): Promise<boolean> {
    return true;
  }

  parseWebhookEvent(payload: string) {
    return JSON.parse(payload) as import("@/application/ports/billing").StripeWebhookEvent;
  }

  tierFromPriceId(priceId: string) {
    if (priceId === "price_pro") return "pro" as const;
    if (priceId === "price_premium") return "premium" as const;
    return null;
  }
}

describe("feature matrix", () => {
  it("maps tiers to billable features", () => {
    expect(tierIncludesFeature("free", "generate_plan")).toBe(false);
    expect(tierIncludesFeature("pro", "generate_plan")).toBe(true);
    expect(tierIncludesFeature("pro", "wearables")).toBe(false);
    expect(tierIncludesFeature("premium", "wearables")).toBe(true);
    expect(requiredTierForFeature("wearables")).toBe("premium");
    expect(listFeaturesForTier("free")).toEqual(["manual_plan"]);
    expect(listFeaturesForTier("pro")).toContain("adapt_plan");
  });
});

describe("HandleStripeWebhookUseCase", () => {
  it("upgrades tier on checkout.session.completed", async () => {
    const subscriptions = new MemorySubscriptionRepository();
    const userBilling = new MemoryUserBillingRepository();
    const billing = new StubBillingClient();
    const handler = new HandleStripeWebhookUseCase(subscriptions, userBilling, billing);
    const userId = createUserId("user-1");

    const payload = JSON.stringify({
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: userId,
          customer: "cus_123",
          subscription: "sub_123",
          metadata: { tier: "pro", userId },
        },
      },
    });

    const result = await handler.execute(payload, "sig_test");
    expect(isOk(result)).toBe(true);

    const subscription = await subscriptions.findByUserId(userId);
    expect(subscription?.tier).toBe("pro");
    expect(await userBilling.getStripeCustomerId(userId)).toBe("cus_123");
  });

  it("downgrades to free when subscription is deleted", async () => {
    const subscriptions = new MemorySubscriptionRepository();
    const userBilling = new MemoryUserBillingRepository();
    const billing = new StubBillingClient();
    const handler = new HandleStripeWebhookUseCase(subscriptions, userBilling, billing);
    const userId = createUserId("user-2");

    await subscriptions.upsert({
      userId,
      tier: "premium",
      stripeSubscriptionId: "sub_del",
    });

    const payload = JSON.stringify({
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_del",
        },
      },
    });

    await handler.execute(payload, "sig_test");
    const subscription = await subscriptions.findByUserId(userId);
    expect(subscription?.tier).toBe("free");
    expect(subscription?.status).toBe("canceled");
  });
});

describe("subscription use cases", () => {
  it("returns free tier by default", async () => {
    const subscriptions = new MemorySubscriptionRepository();
    const getSubscription = new GetSubscriptionUseCase(subscriptions);
    const userId = createUserId("user-free");

    const result = await getSubscription.execute(userId);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.tier).toBe("free");
  });

  it("supports stub checkout upgrades for local development", async () => {
    const subscriptions = new MemorySubscriptionRepository();
    const completeStubCheckout = new CompleteStubCheckoutUseCase(subscriptions);
    const userId = createUserId("user-stub");

    const result = await completeStubCheckout.execute(userId, "premium");
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.tier).toBe("premium");
  });
});
