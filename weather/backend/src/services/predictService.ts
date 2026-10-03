import type { AiPrediction, ApiResponse } from '../types.js';
import { z } from 'zod';
import type { ReadThroughCache } from '../cache/readThrough.js';
import { UpstreamError } from '../errors.js';
import { coordKey } from '../lib/geo.js';
import { buildUrl, getJson, type FetchLike } from '../providers/openmeteo/http.js';
import type { Coords } from '../providers/ports.js';
import { cachedResponse, type ServiceResult } from './common.js';

/** Port for the Python AI service (weather/ai). */
export interface AiPredictionProvider {
  predict(c: Coords, hours: number): Promise<ApiResponse<AiPrediction>>;
  /** Liveness probe (GET /health); resolves to the service's health body or throws. */
  health?(): Promise<AiHealth>;
}

export interface AiHealth {
  status: string;
  service?: string;
  version?: string;
  uptimeSeconds?: number;
  dataMode?: string;
  modelsLoaded?: number;
}

const envelope = z.object({
  data: z.object({ location: z.object({}).passthrough(), hourly: z.array(z.unknown()), risks: z.array(z.unknown()) }).passthrough(),
  meta: z.object({}).passthrough(),
});

export class HttpAiPredictionProvider implements AiPredictionProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl?: FetchLike,
  ) {}

  private url(path: string, params: Record<string, string | number | undefined> = {}): string {
    return buildUrl(new URL(path, this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`).toString(), params);
  }

  private async get(url: string, timeoutMs: number): Promise<unknown> {
    const opts: Parameters<typeof getJson>[1] = { timeoutMs, upstream: 'ai-service' };
    if (this.fetchImpl) opts.fetch = this.fetchImpl;
    return getJson(url, opts);
  }

  async health(): Promise<AiHealth> {
    const json = await this.get(this.url('health'), Math.min(this.timeoutMs, 3000));
    const r = z.object({ status: z.string() }).passthrough().safeParse(json);
    if (!r.success) throw new UpstreamError('ai-service', 'parse', 'health response is not an object with status');
    return r.data as AiHealth;
  }

  async predict(c: Coords, hours: number): Promise<ApiResponse<AiPrediction>> {
    const json = await this.get(this.url('predict', { lat: c.lat, lon: c.lon, hours }), this.timeoutMs);
    const parsed = envelope.safeParse(json);
    if (!parsed.success) throw new UpstreamError('ai-service', 'parse', 'response is not an ApiResponse<AiPrediction>');
    // Pass the body through untouched; make sure the envelope flags exist.
    const body = json as ApiResponse<AiPrediction>;
    const meta = body.meta as Partial<ApiResponse<AiPrediction>['meta']>;
    body.meta = { provider: meta.provider ?? 'skycast-ai', fetchedAt: meta.fetchedAt ?? new Date().toISOString(), mock: meta.mock ?? false, stale: false };
    return body;
  }
}

export type AiReachability = 'reachable' | 'unreachable' | 'unknown';

/** /predict proxy: cached 30 min, stale-while-error, never mocked. */
export class PredictService {
  constructor(
    private readonly ai: AiPredictionProvider,
    private readonly cache: ReadThroughCache,
    private readonly ttlSeconds: number,
  ) {}

  /** Probe the AI service for /health (short timeout, cached 30 s so health checks stay cheap). */
  async reachability(): Promise<{ ai: AiReachability; aiService?: AiHealth }> {
    if (!this.ai.health) return { ai: 'unknown' };
    try {
      const r = await this.cache.getOrLoad('predict:health', () => this.ai.health!(), { ttlSeconds: 30 });
      return { ai: r.status === 'STALE' ? 'unreachable' : 'reachable', aiService: r.value };
    } catch {
      return { ai: 'unreachable' };
    }
  }

  get(c: Coords, hours: number): Promise<ServiceResult<AiPrediction>> {
    return cachedResponse(this.cache, `predict:${coordKey(c.lat, c.lon)}:${hours}`, { ttlSeconds: this.ttlSeconds, autoFallback: false, mockTtlSeconds: 0 }, () =>
      this.ai.predict(c, hours),
    );
  }
}
