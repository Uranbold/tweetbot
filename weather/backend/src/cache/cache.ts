/**
 * Cache port. Async so a Redis adapter can implement it unchanged; entries carry both a
 * freshness deadline (expiresAt) and a retention deadline (staleUntil) for stale-while-error.
 */
export interface CacheEntry<T> {
  value: T;
  storedAt: number; // epoch ms
  expiresAt: number; // epoch ms — fresh until
  staleUntil: number; // epoch ms — retained (for stale-while-error) until
}

export interface Cache {
  /** Returns the entry while it is fresh or still retained as stale; undefined otherwise. */
  get<T>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number, staleSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}
