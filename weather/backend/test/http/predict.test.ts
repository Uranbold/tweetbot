import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeApp } from '../helpers/app.js';
import { aiBody, fakeAi } from '../helpers/ai.js';
import { jsonResponse } from '../helpers/fixtures.js';

let app: FastifyInstance;
afterEach(async () => app?.close());

const risk = { hazard: 'cold-wave' as const, severity: 'warning' as const, probability: 0.8, rationale: '6/7 models below −15 °C', expectedStart: '2026-10-03T06:00' };

describe('GET /predict (AI proxy)', () => {
  it('passes the AI service body through and caches it', async () => {
    const ai = fakeAi([risk]);
    ({ app } = await makeApp({}, { ai: ai.provider }));
    const r = await app.inject('/api/v1/predict?lat=47.92&lon=106.92&hours=72');
    expect(r.statusCode).toBe(200);
    expect(r.headers['x-cache']).toBe('MISS');
    expect(r.json()).toEqual(aiBody([risk]));
    const again = await app.inject('/api/v1/predict?lat=47.92&lon=106.92');
    expect(again.headers['x-cache']).toBe('HIT');
    expect(again.headers['cache-control']).toMatch(/max-age=\d+/);
    expect(ai.state.calls).toBe(1);
  });

  it('returns 503 UPSTREAM_UNAVAILABLE when the AI service is down (never mocked)', async () => {
    const ai = fakeAi();
    ai.state.up = false;
    ({ app } = await makeApp({ PROVIDER_MODE: 'auto' }, { ai: ai.provider }));
    const r = await app.inject('/api/v1/predict?lat=47.92&lon=106.92');
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('serves a stale cached prediction when the AI service goes down', async () => {
    let t = Date.parse('2026-10-01T14:00:00Z');
    const ai = fakeAi();
    ({ app } = await makeApp({ CACHE_TTL_PREDICT: '1800' }, { ai: ai.provider, clock: () => new Date(t) }));
    await app.inject('/api/v1/predict?lat=47.92&lon=106.92');
    ai.state.up = false;
    t += 1801_000;
    const r = await app.inject('/api/v1/predict?lat=47.92&lon=106.92');
    expect(r.statusCode).toBe(200);
    expect(r.headers['x-cache']).toBe('STALE');
    expect(r.json().meta.stale).toBe(true);
  });

  it('calls AI_SERVICE_URL/predict with lat, lon, hours via fetch', async () => {
    const urls: string[] = [];
    const fetch = async (u: string) => {
      urls.push(u);
      return jsonResponse(aiBody());
    };
    ({ app } = await makeApp({ AI_SERVICE_URL: 'http://ai.internal:8790' }, { fetch }));
    const r = await app.inject('/api/v1/predict?lat=37.57&lon=126.98&hours=24');
    expect(r.statusCode).toBe(200);
    expect(urls).toEqual(['http://ai.internal:8790/predict?lat=37.57&lon=126.98&hours=24']);
  });

  it('uses AI_TIMEOUT_MS (not UPSTREAM_TIMEOUT_MS) for the AI service', async () => {
    let aborted = false;
    const slow = (_u: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const t = setTimeout(() => resolve(jsonResponse(aiBody())), 150);
        init?.signal?.addEventListener('abort', () => {
          aborted = true;
          clearTimeout(t);
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    ({ app } = await makeApp({ UPSTREAM_TIMEOUT_MS: '100', AI_TIMEOUT_MS: '1000' }, { fetch: slow }));
    expect((await app.inject('/api/v1/predict?lat=1&lon=1')).statusCode).toBe(200);
    expect(aborted).toBe(false);
    await app.close();
    ({ app } = await makeApp({ UPSTREAM_TIMEOUT_MS: '5000', AI_TIMEOUT_MS: '100' }, { fetch: slow }));
    expect((await app.inject('/api/v1/predict?lat=1&lon=1')).statusCode).toBe(503);
    expect(aborted).toBe(true);
  });

  it('/health surfaces AI reachability', async () => {
    const ai = fakeAi();
    ({ app } = await makeApp({}, { ai: ai.provider }));
    expect((await app.inject('/api/v1/health')).json()).toMatchObject({ ai: 'reachable', aiService: { status: 'ok', dataMode: 'synthetic' } });
    await app.close();
    ai.state.up = false;
    ({ app } = await makeApp({}, { ai: ai.provider }));
    expect((await app.inject('/api/v1/health')).json().ai).toBe('unreachable');
  });

  it('rejects a malformed AI response as UPSTREAM_UNAVAILABLE', async () => {
    ({ app } = await makeApp({}, { fetch: async () => jsonResponse({ hello: 'world' }) }));
    const r = await app.inject('/api/v1/predict?lat=1&lon=1');
    expect(r.statusCode).toBe(503);
  });
});

describe('GET /regions/:id/alerts', () => {
  it('returns alerts, AI risks and air for the region', async () => {
    const ai = fakeAi([risk]);
    ({ app } = await makeApp({}, { ai: ai.provider }));
    const r = await app.inject('/api/v1/regions/mn-ulaanbaatar/alerts');
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(Array.isArray(body.data.alerts)).toBe(true);
    expect(body.data.risks).toEqual([risk]);
    expect(body.data.air).toHaveProperty('overallGrade');
    expect(body.meta.mock).toBe(true);
  });

  it('degrades to risks: [] when the AI service is unreachable', async () => {
    const ai = fakeAi([risk]);
    ai.state.up = false;
    ({ app } = await makeApp({}, { ai: ai.provider }));
    const body = (await app.inject('/api/v1/regions/kr-seoul/alerts')).json();
    expect(body.data.risks).toEqual([]);
  });

  it('404 for unknown regions', async () => {
    ({ app } = await makeApp());
    const r = await app.inject('/api/v1/regions/xx-atlantis/alerts');
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe('NOT_FOUND');
  });
});
