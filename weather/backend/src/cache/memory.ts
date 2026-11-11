import type { Cache, CacheEntry } from './cache.js';

/** In-process LRU + TTL cache. Map insertion order doubles as recency order. */
export class MemoryLruCache implements Cache {
  private readonly map = new Map<string, CacheEntry<unknown>>();

  constructor(
    private readonly maxEntries = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.now() >= entry.staleUntil) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry as CacheEntry<T>;
  }

  async set<T>(key: string, value: T, ttlSeconds: number, staleSeconds: number): Promise<void> {
    const now = this.now();
    const expiresAt = now + ttlSeconds * 1000;
    this.map.delete(key);
    this.map.set(key, { value, storedAt: now, expiresAt, staleUntil: expiresAt + staleSeconds * 1000 });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async clear(): Promise<void> {
    this.map.clear();
  }

  async size(): Promise<number> {
    return this.map.size;
  }
}
