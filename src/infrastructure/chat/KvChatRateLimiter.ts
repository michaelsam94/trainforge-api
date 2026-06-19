import {
  getChatMessageLimit,
  getChatRateLimitWindowSeconds,
  type SubscriptionTier,
} from "@/domain/chat";
import type { IChatRateLimiter } from "@/application/ports/chat";

function hourBucket(reference = new Date()): string {
  return reference.toISOString().slice(0, 13);
}

export class KvChatRateLimiter implements IChatRateLimiter {
  constructor(private readonly cache: KVNamespace) {}

  async checkAndIncrement(
    userId: string,
    tier: SubscriptionTier = "free",
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limit = getChatMessageLimit(tier);
    const key = `chat-rate:${userId}:${hourBucket()}`;
    const current = Number((await this.cache.get(key)) ?? "0");

    if (current >= limit) {
      return { allowed: false, remaining: 0, limit };
    }

    await this.cache.put(key, String(current + 1), {
      expirationTtl: getChatRateLimitWindowSeconds(),
    });

    return { allowed: true, remaining: limit - current - 1, limit };
  }
}
