import type { Cache } from './cache.js';

export type CacheStatus = 'HIT' | 'MISS' | 'STALE';

export interface CacheResult<T> {
  value: T;
  status: CacheStatus;
  /** Seconds the client may cache this response (remaining TTL on HIT). */
  maxAge: number;
}

export interface LoadOptions<T> {
  ttlSeconds: number;
  /**
   * Marks a "degraded" value (e.g. produced by the mock fallback). A degraded value never
   * overwrites a retained non-degraded one — the last good real value is served as STALE —
   * and is cached for at most `degradedTtlSeconds`.
   */
  degraded?: (value: T) => boolean;
  degradedTtlSeconds?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  stale: number;
  inflight: number;
}

/** Max-age advertised for STALE responses so clients retry soon. */
const STALE_MAX_AGE = 60;

/**
 * Cache-aside with single-flight request coalescing and stale-while-error:
 *  - fresh entry → HIT
 *  - otherwise one loader runs per key; concurrent callers share its promise
 *  - loader fails and a retained entry exists → that entry, STALE
 */
export class ReadThroughCache {
  private readonly inflight = new Map<string, Promise<CacheResult<unknown>>>();
  private readonly stats = { hits: 0, misses: 0, stale: 0 };

  constructor(
    readonly store: Cache,
    private readonly staleSeconds: number,
    private readonly now: () => number = Date.now,
  ) {}

  async getOrLoad<T>(key: string, loader: () => Promise<T>, opts: LoadOptions<T>): Promise<CacheResult<T>> {
    const entry = await this.store.get<T>(key);
    const now = this.now();
    if (entry && now < entry.expiresAt) {
      this.stats.hits++;
      return { value: entry.value, status: 'HIT', maxAge: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)) };
    }
    this.stats.misses++;
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<CacheResult<T>>;

    const run = (async (): Promise<CacheResult<T>> => {
      try {
        const value = await loader();
        const degraded = opts.degraded?.(value) ?? false;
        if (degraded && entry && !opts.degraded!(entry.value)) {
          this.stats.stale++;
          return { value: entry.value, status: 'STALE', maxAge: STALE_MAX_AGE };
        }
        const ttl = degraded && opts.degradedTtlSeconds ? Math.min(opts.ttlSeconds, opts.degradedTtlSeconds) : opts.ttlSeconds;
        await this.store.set(key, value, ttl, this.staleSeconds);
        return { value, status: 'MISS', maxAge: ttl };
      } catch (err) {
        if (entry) {
          this.stats.stale++;
          return { value: entry.value, status: 'STALE', maxAge: STALE_MAX_AGE };
        }
        throw err;
      }
    })();
    this.inflight.set(key, run);
    try {
      return await run;
    } finally {
      this.inflight.delete(key);
    }
  }

  snapshot(): CacheStats {
    return { ...this.stats, inflight: this.inflight.size };
  }
}
