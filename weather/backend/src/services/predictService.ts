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

  async predict(c: Coords, hours: number): Promise<ApiResponse<AiPrediction>> {
    const url = buildUrl(new URL('predict', this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`).toString(), {
      lat: c.lat,
      lon: c.lon,
      hours,
    });
    const opts: Parameters<typeof getJson>[1] = { timeoutMs: this.timeoutMs, upstream: 'ai-service' };
    if (this.fetchImpl) opts.fetch = this.fetchImpl;
    const json = await getJson(url, opts);
    const parsed = envelope.safeParse(json);
    if (!parsed.success) throw new UpstreamError('ai-service', 'parse', 'response is not an ApiResponse<AiPrediction>');
    // Pass the body through untouched; make sure the envelope flags exist.
    const body = json as ApiResponse<AiPrediction>;
    const meta = body.meta as Partial<ApiResponse<AiPrediction>['meta']>;
    body.meta = { provider: meta.provider ?? 'skycast-ai', fetchedAt: meta.fetchedAt ?? new Date().toISOString(), mock: meta.mock ?? false, stale: false };
    return body;
  }
}

/** /predict proxy: cached 30 min, stale-while-error, never mocked. */
export class PredictService {
  constructor(
    private readonly ai: AiPredictionProvider,
    private readonly cache: ReadThroughCache,
    private readonly ttlSeconds: number,
  ) {}

  get(c: Coords, hours: number): Promise<ServiceResult<AiPrediction>> {
    return cachedResponse(this.cache, `predict:${coordKey(c.lat, c.lon)}:${hours}`, { ttlSeconds: this.ttlSeconds, autoFallback: false, mockTtlSeconds: 0 }, () =>
      this.ai.predict(c, hours),
    );
  }
}
