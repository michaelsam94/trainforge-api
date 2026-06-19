interface Env {
  ENVIRONMENT: string;
  DB: D1Database;
  CACHE: KVNamespace;
  MEDIA?: R2Bucket;
  PLAN_QUEUE?: Queue;
  ANTHROPIC_API_KEY?: string;
  FITBIT_CLIENT_ID?: string;
  FITBIT_CLIENT_SECRET?: string;
  APP_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_PREMIUM?: string;
  SENTRY_DSN?: string;
}
