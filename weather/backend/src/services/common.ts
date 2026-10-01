import type { ApiMeta, ApiResponse } from '../types.js';
import type { CacheResult, CacheStatus, ReadThroughCache } from '../cache/readThrough.js';
import type { Source } from '../providers/ports.js';

export interface ServiceResult<T> {
  body: ApiResponse<T>;
  cache: CacheStatus;
  maxAge: number;
}

/** Combine provider sources into ApiMeta: providers joined with "+", mock if any part is mock. */
export function metaFrom(...sources: (Source | null | undefined)[]): ApiMeta {
  const present = sources.filter((s): s is Source => !!s);
  const providers = [...new Set(present.map((s) => s.provider))];
  const fetchedAt = present.map((s) => s.fetchedAt).sort()[0] ?? new Date().toISOString();
  return { provider: providers.join('+') || 'unknown', fetchedAt, stale: false, mock: present.some((s) => s.mock) };
}

export interface CachePolicy {
  ttlSeconds: number;
  /** In auto mode, mock-fallback results are "degraded": short TTL, never replace real data. */
  autoFallback: boolean;
  mockTtlSeconds: number;
}

/** Run a loader through the read-through cache and stamp meta.stale for STALE results. */
export async function cachedResponse<T>(
  cache: ReadThroughCache,
  key: string,
  policy: CachePolicy,
  loader: () => Promise<ApiResponse<T>>,
): Promise<ServiceResult<T>> {
  const opts: Parameters<ReadThroughCache['getOrLoad']>[2] = { ttlSeconds: policy.ttlSeconds };
  if (policy.autoFallback) {
    opts.degraded = (v) => (v as ApiResponse<T>).meta.mock;
    opts.degradedTtlSeconds = policy.mockTtlSeconds;
  }
  const r = (await cache.getOrLoad(key, loader, opts)) as CacheResult<ApiResponse<T>>;
  const body = r.status === 'STALE' ? { data: r.value.data, meta: { ...r.value.meta, stale: true } } : r.value;
  return { body, cache: r.status, maxAge: r.maxAge };
}
