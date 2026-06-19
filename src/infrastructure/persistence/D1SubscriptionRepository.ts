import {
  normalizeSubscriptionTier,
  type Subscription,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@/domain/billing";
import type { UserId } from "@/domain/user";
import type {
  ISubscriptionRepository,
  IUserBillingRepository,
} from "@/application/ports/billing";

type SubscriptionRow = {
  user_id: string;
  tier: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  current_period_end: string | null;
  updated_at: string;
};

function mapRow(row: SubscriptionRow): Subscription {
  return {
    userId: row.user_id,
    tier: normalizeSubscriptionTier(row.tier),
    stripeSubscriptionId: row.stripe_subscription_id ?? undefined,
    stripePriceId: row.stripe_price_id ?? undefined,
    status: row.status as SubscriptionStatus,
    currentPeriodEnd: row.current_period_end ?? undefined,
    updatedAt: row.updated_at,
  };
}

export class D1SubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserId(userId: UserId): Promise<Subscription | null> {
    const row = await this.db
      .prepare(
        `SELECT user_id, tier, stripe_subscription_id, stripe_price_id, status, current_period_end, updated_at
         FROM subscriptions WHERE user_id = ?`,
      )
      .bind(userId)
      .first<SubscriptionRow>();

    return row ? mapRow(row) : null;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    const row = await this.db
      .prepare(
        `SELECT s.user_id, s.tier, s.stripe_subscription_id, s.stripe_price_id, s.status, s.current_period_end, s.updated_at
         FROM subscriptions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE u.stripe_customer_id = ?`,
      )
      .bind(stripeCustomerId)
      .first<SubscriptionRow>();

    return row ? mapRow(row) : null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const row = await this.db
      .prepare(
        `SELECT user_id, tier, stripe_subscription_id, stripe_price_id, status, current_period_end, updated_at
         FROM subscriptions WHERE stripe_subscription_id = ?`,
      )
      .bind(stripeSubscriptionId)
      .first<SubscriptionRow>();

    return row ? mapRow(row) : null;
  }

  async upsert(input: {
    userId: UserId;
    tier: SubscriptionTier;
    status?: SubscriptionStatus;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    currentPeriodEnd?: string | null;
  }): Promise<Subscription> {
    const now = new Date().toISOString();
    const status = input.status ?? "active";

    await this.db
      .prepare(
        `INSERT INTO subscriptions (
           user_id, tier, stripe_subscription_id, stripe_price_id, status, current_period_end, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           tier = excluded.tier,
           stripe_subscription_id = excluded.stripe_subscription_id,
           stripe_price_id = excluded.stripe_price_id,
           status = excluded.status,
           current_period_end = excluded.current_period_end,
           updated_at = excluded.updated_at`,
      )
      .bind(
        input.userId,
        input.tier,
        input.stripeSubscriptionId ?? null,
        input.stripePriceId ?? null,
        status,
        input.currentPeriodEnd ?? null,
        now,
      )
      .run();

    const saved = await this.findByUserId(input.userId);
    if (!saved) {
      throw new Error("Failed to persist subscription");
    }
    return saved;
  }
}

export class D1UserBillingRepository implements IUserBillingRepository {
  constructor(private readonly db: D1Database) {}

  async getStripeCustomerId(userId: UserId): Promise<string | null> {
    const row = await this.db
      .prepare(`SELECT stripe_customer_id FROM users WHERE id = ?`)
      .bind(userId)
      .first<{ stripe_customer_id: string | null }>();

    return row?.stripe_customer_id ?? null;
  }

  async setStripeCustomerId(userId: UserId, stripeCustomerId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?`)
      .bind(stripeCustomerId, new Date().toISOString(), userId)
      .run();
  }

  async findUserIdByStripeCustomerId(stripeCustomerId: string): Promise<UserId | null> {
    const row = await this.db
      .prepare(`SELECT id FROM users WHERE stripe_customer_id = ?`)
      .bind(stripeCustomerId)
      .first<{ id: string }>();

    return row ? (row.id as UserId) : null;
  }
}

export async function resolveSubscriptionTier(
  subscriptions: ISubscriptionRepository,
  userId: UserId,
): Promise<SubscriptionTier> {
  const subscription = await subscriptions.findByUserId(userId);
  if (!subscription || subscription.status === "canceled") {
    return "free";
  }
  return subscription.tier;
}
