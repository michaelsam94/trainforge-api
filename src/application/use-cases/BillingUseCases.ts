import {
  listFeaturesForTier,
  normalizeSubscriptionTier,
  type Subscription,
  type SubscriptionTier,
} from "@/domain/billing";
import { DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import type { UserId } from "@/domain/user";
import type {
  CheckoutTier,
  IBillingClient,
  ISubscriptionRepository,
  IUserBillingRepository,
} from "@/application/ports/billing";
import type { IUserRepository } from "@/application/ports";
import { resolveSubscriptionTier } from "@/infrastructure/persistence/D1SubscriptionRepository";

export class GetSubscriptionUseCase {
  constructor(private readonly subscriptions: ISubscriptionRepository) {}

  async execute(userId: UserId): Promise<
    Result<
      {
        tier: SubscriptionTier;
        status: Subscription["status"];
        currentPeriodEnd?: string;
        features: ReturnType<typeof listFeaturesForTier>;
      },
      DomainError
    >
  > {
    const subscription = await this.subscriptions.findByUserId(userId);
    const tier = await resolveSubscriptionTier(this.subscriptions, userId);

    return ok({
      tier,
      status: subscription?.status ?? "active",
      currentPeriodEnd: subscription?.currentPeriodEnd,
      features: listFeaturesForTier(tier),
    });
  }
}

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly users: IUserRepository,
    private readonly userBilling: IUserBillingRepository,
    private readonly billing: IBillingClient,
  ) {}

  async execute(input: {
    userId: UserId;
    tier: CheckoutTier;
    successUrl: string;
    cancelUrl: string;
  }): Promise<Result<{ url: string; sessionId: string }, DomainError>> {
    const user = await this.users.findById(input.userId);
    if (!user) {
      return err(DomainError.notFound("user"));
    }

    const stripeCustomerId = await this.userBilling.getStripeCustomerId(input.userId);
    const session = await this.billing.createCheckoutSession({
      userId: input.userId,
      email: user.email,
      tier: input.tier,
      stripeCustomerId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    return ok(session);
  }
}

export class CreatePortalSessionUseCase {
  constructor(
    private readonly userBilling: IUserBillingRepository,
    private readonly billing: IBillingClient,
  ) {}

  async execute(input: {
    userId: UserId;
    returnUrl: string;
  }): Promise<Result<{ url: string }, DomainError>> {
    const stripeCustomerId = await this.userBilling.getStripeCustomerId(input.userId);
    if (!stripeCustomerId) {
      return err(DomainError.validation("No billing account found for this user"));
    }

    const session = await this.billing.createPortalSession({
      stripeCustomerId,
      returnUrl: input.returnUrl,
    });

    return ok(session);
  }
}

export class HandleStripeWebhookUseCase {
  constructor(
    private readonly subscriptions: ISubscriptionRepository,
    private readonly userBilling: IUserBillingRepository,
    private readonly billing: IBillingClient,
  ) {}

  async execute(payload: string, signature: string | undefined): Promise<Result<{ handled: boolean }, DomainError>> {
    const valid = await this.billing.verifyWebhookSignature(payload, signature);
    if (!valid) {
      return err(DomainError.unauthorized("Invalid Stripe webhook signature"));
    }

    const event = this.billing.parseWebhookEvent(payload);

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }

    return ok({ handled: true });
  }

  private async handleCheckoutCompleted(object: Record<string, unknown>): Promise<void> {
    const userId = readString(object.client_reference_id) ?? readMetadata(object, "userId");
    const tier = normalizeSubscriptionTier(
      readMetadata(object, "tier") ?? readString(object.mode) ?? "free",
    );
    const customerId = readString(object.customer);
    const subscriptionId = readString(object.subscription);

    if (!userId || tier === "free") return;

    if (customerId) {
      await this.userBilling.setStripeCustomerId(userId as UserId, customerId);
    }

    await this.subscriptions.upsert({
      userId: userId as UserId,
      tier: tier === "premium" ? "premium" : "pro",
      stripeSubscriptionId: subscriptionId,
      status: "active",
    });
  }

  private async handleSubscriptionUpdated(object: Record<string, unknown>): Promise<void> {
    const subscriptionId = readString(object.id);
    const customerId = readString(object.customer);
    const status = readString(object.status) ?? "active";
    const currentPeriodEnd = object.current_period_end
      ? new Date(Number(object.current_period_end) * 1000).toISOString()
      : undefined;
    const priceId = readNestedString(object, "items", "data", 0, "price", "id");

    let userId: UserId | null = null;
    if (subscriptionId) {
      const existing = await this.subscriptions.findByStripeSubscriptionId(subscriptionId);
      userId = (existing?.userId as UserId | undefined) ?? null;
    }

    if (!userId && customerId) {
      userId = await this.userBilling.findUserIdByStripeCustomerId(customerId);
    }

    if (!userId) return;

    const tierFromPrice = priceId ? this.billing.tierFromPriceId(priceId) : null;
    const tier = status === "active" || status === "trialing"
      ? tierFromPrice ?? "pro"
      : "free";

    await this.subscriptions.upsert({
      userId,
      tier,
      status: status === "canceled" ? "canceled" : (status as Subscription["status"]),
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodEnd,
    });
  }

  private async handleSubscriptionDeleted(object: Record<string, unknown>): Promise<void> {
    const subscriptionId = readString(object.id);
    if (!subscriptionId) return;

    const existing = await this.subscriptions.findByStripeSubscriptionId(subscriptionId);
    if (!existing) return;

    await this.subscriptions.upsert({
      userId: existing.userId as UserId,
      tier: "free",
      status: "canceled",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
    });
  }
}

export class CompleteStubCheckoutUseCase {
  constructor(private readonly subscriptions: ISubscriptionRepository) {}

  async execute(userId: UserId, tier: CheckoutTier): Promise<Result<{ tier: SubscriptionTier }, DomainError>> {
    const subscription = await this.subscriptions.upsert({
      userId,
      tier,
      status: "active",
      stripeSubscriptionId: `stub_${tier}_${userId}`,
    });

    return ok({ tier: subscription.tier });
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readMetadata(object: Record<string, unknown>, key: string): string | undefined {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  return readString((metadata as Record<string, unknown>)[key]);
}

function readNestedString(object: Record<string, unknown>, ...path: (string | number)[]): string | undefined {
  let current: unknown = object;
  for (const segment of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return readString(current);
}
