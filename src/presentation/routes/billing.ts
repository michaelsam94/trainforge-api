import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { isErr } from "@/domain/shared/result";
import { requireAuth } from "@/presentation/middleware/require-auth";
import {
  checkoutBodySchema,
  portalBodySchema,
  stubCheckoutQuerySchema,
  toSubscriptionDto,
} from "@/presentation/dto/billing";

export const billingRoutes = new Hono<{ Bindings: Env }>();

billingRoutes.get("/subscription", requireAuth(), async (c) => {
  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.getSubscription.execute(user.id);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ subscription: toSubscriptionDto(result.value) });
});

billingRoutes.post(
  "/checkout",
  requireAuth(),
  zValidator("json", checkoutBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const body = c.req.valid("json");
    const appUrl = c.env.APP_URL ?? "http://localhost:2021";

    const result = await container.createCheckoutSession.execute({
      userId: user.id,
      tier: body.tier,
      successUrl: body.successUrl ?? `${appUrl}/profile?checkout=success`,
      cancelUrl: body.cancelUrl ?? `${appUrl}/pricing?checkout=canceled`,
    });

    if (isErr(result)) {
      throw result.error;
    }

    return c.json(result.value);
  },
);

billingRoutes.post(
  "/portal",
  requireAuth(),
  zValidator("json", portalBodySchema),
  async (c) => {
    const container = c.get("container");
    const user = c.get("currentUser");
    const body = c.req.valid("json");
    const appUrl = c.env.APP_URL ?? "http://localhost:2021";

    const result = await container.createPortalSession.execute({
      userId: user.id,
      returnUrl: body.returnUrl ?? `${appUrl}/profile`,
    });

    if (isErr(result)) {
      throw result.error;
    }

    return c.json(result.value);
  },
);

billingRoutes.post("/checkout/stub", requireAuth(), async (c) => {
  if (c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: { code: "FORBIDDEN", message: "Stub checkout disabled" } }, 403);
  }

  const tier = c.req.query("tier");
  const parsed = stubCheckoutQuerySchema.safeParse({ tier });
  if (!parsed.success) {
    return c.json({ error: { code: "VALIDATION", message: "tier must be pro or premium" } }, 400);
  }

  const container = c.get("container");
  const user = c.get("currentUser");
  const result = await container.completeStubCheckout.execute(user.id, parsed.data.tier);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ subscription: { tier: result.value.tier } });
});

billingRoutes.post("/webhook", async (c) => {
  const container = c.get("container");
  const payload = await c.req.text();
  const signature = c.req.header("stripe-signature");
  const result = await container.handleStripeWebhook.execute(payload, signature);

  if (isErr(result)) {
    throw result.error;
  }

  return c.json({ received: true });
});
