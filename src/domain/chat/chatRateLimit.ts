import type { SubscriptionTier } from "@/domain/billing";

export type { SubscriptionTier };

export function getChatMessageLimit(tier: SubscriptionTier = "free"): number {
  if (tier === "premium") return 200;
  if (tier === "pro") return 100;
  return 20;
}

export function getChatRateLimitWindowSeconds(): number {
  return 3600;
}
