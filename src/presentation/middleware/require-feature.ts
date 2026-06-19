import type { BillableFeature } from "@/domain/billing";
import { tierIncludesFeature } from "@/domain/billing";
import { DomainError } from "@/domain/shared/errors";
import type { Context, Next } from "hono";

export function requireFeature(feature: BillableFeature) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get("currentUser");

    if (!tierIncludesFeature(user.subscriptionTier, feature)) {
      throw DomainError.forbidden("Upgrade your plan to access this feature.");
    }

    return next();
  };
}
