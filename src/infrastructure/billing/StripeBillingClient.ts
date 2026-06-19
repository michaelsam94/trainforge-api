import type {
  CheckoutSessionResult,
  CheckoutTier,
  IBillingClient,
  PortalSessionResult,
  StripeWebhookEvent,
} from "@/application/ports/billing";

type StripeClientConfig = {
  secretKey?: string;
  webhookSecret?: string;
  pricePro?: string;
  pricePremium?: string;
  appUrl?: string;
};

function encodeFormBody(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

async function stripeRequest<T>(
  secretKey: string,
  path: string,
  body?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? encodeFormBody(body) : undefined,
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    const errorBody = payload as { error?: { message?: string } };
    throw new Error(errorBody.error?.message ?? "Stripe request failed");
  }
  return payload as T;
}

async function parseStripeSignature(
  signature: string | undefined,
  secret: string,
  payload: string,
): Promise<boolean> {
  if (!signature) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  ) as Record<string, string>;

  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  const signedPayload = `${timestamp}.${payload}`;
  return verifyHmacSha256(secret, signedPayload, expected);
}

async function verifyHmacSha256(secret: string, payload: string, expectedHex: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const actualHex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqual(actualHex, expectedHex);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

export class StripeBillingClient implements IBillingClient {
  constructor(private readonly config: StripeClientConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.secretKey);
  }

  tierFromPriceId(priceId: string): CheckoutTier | null {
    if (priceId && priceId === this.config.pricePro) return "pro";
    if (priceId && priceId === this.config.pricePremium) return "premium";
    return null;
  }

  async createCheckoutSession(input: {
    userId: string;
    email: string;
    tier: CheckoutTier;
    stripeCustomerId?: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSessionResult> {
    if (!this.isConfigured()) {
      const appUrl = this.config.appUrl ?? "http://localhost:2021";
      return {
        sessionId: `stub_${input.tier}_${input.userId}`,
        url: `${appUrl}/profile?checkout=stub&tier=${input.tier}`,
      };
    }

    const priceId = input.tier === "premium" ? this.config.pricePremium : this.config.pricePro;
    if (!priceId) {
      throw new Error(`Missing Stripe price id for ${input.tier}`);
    }

    const body: Record<string, string> = {
      mode: "subscription",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      client_reference_id: input.userId,
      customer_email: input.email,
      "metadata[userId]": input.userId,
      "metadata[tier]": input.tier,
      "subscription_data[metadata][userId]": input.userId,
      "subscription_data[metadata][tier]": input.tier,
    };

    if (input.stripeCustomerId) {
      delete body.customer_email;
      body.customer = input.stripeCustomerId;
    }

    const secretKey = this.config.secretKey;
    if (!secretKey) {
      throw new Error("Stripe is not configured");
    }

    const session = await stripeRequest<{ id: string; url: string }>(
      secretKey,
      "/checkout/sessions",
      body,
    );

    return { sessionId: session.id, url: session.url };
  }

  async createPortalSession(input: {
    stripeCustomerId: string;
    returnUrl: string;
  }): Promise<PortalSessionResult> {
    if (!this.isConfigured()) {
      const appUrl = this.config.appUrl ?? "http://localhost:2021";
      return { url: `${appUrl}/profile?portal=stub` };
    }

    const secretKey = this.config.secretKey;
    if (!secretKey) {
      throw new Error("Stripe is not configured");
    }

    const session = await stripeRequest<{ url: string }>(secretKey, "/billing_portal/sessions", {
      customer: input.stripeCustomerId,
      return_url: input.returnUrl,
    });

    return { url: session.url };
  }

  async verifyWebhookSignature(payload: string, signature: string | undefined): Promise<boolean> {
    if (!this.config.webhookSecret) {
      return this.config.secretKey == null;
    }

    return parseStripeSignature(signature, this.config.webhookSecret, payload);
  }

  parseWebhookEvent(payload: string): StripeWebhookEvent {
    return JSON.parse(payload) as StripeWebhookEvent;
  }
}

export function createBillingClient(env: Env): IBillingClient {
  return new StripeBillingClient({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    pricePro: env.STRIPE_PRICE_PRO,
    pricePremium: env.STRIPE_PRICE_PREMIUM,
    appUrl: env.APP_URL,
  });
}
