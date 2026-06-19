export type SubscriptionTier = "free" | "pro" | "premium";

export type BillableFeature =
  | "manual_plan"
  | "generate_plan"
  | "adapt_plan"
  | "chat"
  | "wearables"
  | "advanced_analytics";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "trialing";

export type Subscription = {
  userId: string;
  tier: SubscriptionTier;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
  updatedAt: string;
};

const FEATURE_MATRIX: Record<BillableFeature, SubscriptionTier[]> = {
  manual_plan: ["free", "pro", "premium"],
  generate_plan: ["pro", "premium"],
  adapt_plan: ["pro", "premium"],
  chat: ["pro", "premium"],
  wearables: ["premium"],
  advanced_analytics: ["premium"],
};

export function tierIncludesFeature(
  tier: SubscriptionTier,
  feature: BillableFeature,
): boolean {
  return FEATURE_MATRIX[feature].includes(tier);
}

export function requiredTierForFeature(feature: BillableFeature): SubscriptionTier {
  const tiers = FEATURE_MATRIX[feature];
  if (tiers.includes("free")) return "free";
  if (tiers.includes("pro")) return "pro";
  return "premium";
}

export function listFeaturesForTier(tier: SubscriptionTier): BillableFeature[] {
  return (Object.keys(FEATURE_MATRIX) as BillableFeature[]).filter((feature) =>
    tierIncludesFeature(tier, feature),
  );
}

export function normalizeSubscriptionTier(value: string | undefined): SubscriptionTier {
  if (value === "pro" || value === "premium") return value;
  return "free";
}

export function tierRank(tier: SubscriptionTier): number {
  if (tier === "premium") return 2;
  if (tier === "pro") return 1;
  return 0;
}
