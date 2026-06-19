import { z } from "zod";

export const checkoutBodySchema = z.object({
  tier: z.enum(["pro", "premium"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export const portalBodySchema = z.object({
  returnUrl: z.string().url().optional(),
});

export const stubCheckoutQuerySchema = z.object({
  tier: z.enum(["pro", "premium"]),
});

export function toSubscriptionDto(input: {
  tier: string;
  status: string;
  currentPeriodEnd?: string;
  features: string[];
}) {
  return {
    tier: input.tier,
    status: input.status,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    features: input.features,
  };
}
