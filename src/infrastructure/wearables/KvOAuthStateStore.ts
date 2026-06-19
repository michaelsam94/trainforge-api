import type { IOAuthStateStore } from "@/application/ports/wearable";
import type { WearableProviderId } from "@/domain/wearable";

const TTL_SECONDS = 600;

export class KvOAuthStateStore implements IOAuthStateStore {
  constructor(private readonly cache: KVNamespace) {}

  async save(state: string, payload: { userId: string; provider: WearableProviderId }) {
    await this.cache.put(`oauth-state:${state}`, JSON.stringify(payload), {
      expirationTtl: TTL_SECONDS,
    });
  }

  async consume(state: string) {
    const key = `oauth-state:${state}`;
    const raw = await this.cache.get(key);
    if (!raw) return null;
    await this.cache.delete(key);
    return JSON.parse(raw) as { userId: string; provider: WearableProviderId };
  }
}
