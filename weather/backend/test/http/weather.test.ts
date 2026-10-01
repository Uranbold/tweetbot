import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AirQualityReport, ApiError, ApiResponse, ForecastComparison, Location, NationSnapshot, Region, TodayWeather } from '../../src/types.js';
import { UpstreamError } from '../../src/errors.js';
import { failingProviders, makeApp } from '../helpers/app.js';
import { RECORDED_AT, fixtureFetch } from '../helpers/fixtures.js';

let app: FastifyInstance;
afterEach(async () => app?.close());

describe('GET endpoints (mock mode)', () => {
  it('/weather returns TodayWeather with cache headers, then HIT', async () => {
    ({ app } = await makeApp());
    const r = await app.inject('/api/v1/weather?lat=47.92&lon=106.92');
    expect(r.statusCode).toBe(200);
    expect(r.headers['x-cache']).toBe('MISS');
    expect(r.headers['cache-control']).toMatch(/^public, max-age=\d+$/);
    const body = r.json<ApiResponse<TodayWeather>>();
    expect(body.meta).toMatchObject({ provider: 'mock', mock: true, stale: false });
    expect(body.data.location.name).toBe('Ulaanbaatar');
    expect(body.data.hourly).toHaveLength(48);
    expect(body.data.daily).toHaveLength(10);
    const again = await app.inject('/api/v1/weather?lat=47.9249&lon=106.9151'); // same 2-dp cache key
    expect(again.headers['x-cache']).toBe('HIT');
  });

  it('/air returns the report with scale', async () => {
    ({ app } = await makeApp());
    const body = (await app.inject('/api/v1/air?lat=37.57&lon=126.98')).json<ApiResponse<AirQualityReport>>();
    expect(body.data.location.name).toBe('Seoul');
    expect(body.data.hourly).toHaveLength(72);
    expect(body.data.daily).toHaveLength(4);
    expect(body.data.scale.pm25[0]).toEqual({ grade: 'good', min: 0, max: 15 });
  });

  it('/compare defaults to all models and honours ?models=', async () => {
    ({ app } = await makeApp());
    const all = (await app.inject('/api/v1/compare?lat=37.57&lon=126.98')).json<ApiResponse<ForecastComparison>>();
    expect(all.data.models).toHaveLength(7);
    const two = (await app.inject('/api/v1/compare?lat=37.57&lon=126.98&models=ecmwf,GFS')).json<ApiResponse<ForecastComparison>>();
    expect(two.data.models.map((m) => m.model)).toEqual(['ecmwf', 'gfs']);
    expect(two.data.consensus).toHaveLength(7);
    expect(['high', 'medium', 'low']).toContain(two.data.consensus[0]!.agreement);
  });

  it('/nation returns 10 cities per region group', async () => {
    ({ app } = await makeApp());
    for (const region of ['mn', 'kr', 'world']) {
      const body = (await app.inject(`/api/v1/nation?region=${region}`)).json<ApiResponse<NationSnapshot>>();
      expect(body.data.region).toBe(region);
      expect(body.data.cities).toHaveLength(10);
      expect(body.data.cities[0]!.pm10Grade).toBeDefined();
    }
    const mn = (await app.inject('/api/v1/nation?region=mn')).json<ApiResponse<NationSnapshot>>();
    expect(mn.data.cities.map((c) => c.location.name)).toEqual(['Ulaanbaatar', 'Erdenet', 'Darkhan', 'Choibalsan', 'Ölgii', 'Khovd', 'Mörön', 'Dalanzadgad', 'Sainshand', 'Arvaikheer']);
    expect(mn.data.cities.find((c) => c.location.name === 'Khovd')!.location.timezone).toBe('Asia/Hovd');
  });

  it('/locations/search and /locations/reverse', async () => {
    ({ app } = await makeApp());
    const s = (await app.inject('/api/v1/locations/search?q=seoul')).json<ApiResponse<Location[]>>();
    expect(s.data[0]!.name).toBe('Seoul');
    const r = (await app.inject('/api/v1/locations/reverse?lat=35.10&lon=129.03')).json<ApiResponse<Location>>();
    expect(r.data.name).toBe('Busan');
  });

  it('/regions lists every catalogue city as a Region', async () => {
    ({ app } = await makeApp());
    const body = (await app.inject('/api/v1/regions')).json<ApiResponse<Region[]>>();
    const ids = body.data.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining(['mn-ulaanbaatar', 'kr-seoul', 'kr-jeju', 'mn-olgii', 'jp-tokyo', 'us-washington']));
    expect(new Set(ids).size).toBe(ids.length);
    const ub = body.data.find((r) => r.id === 'mn-ulaanbaatar')!;
    expect(ub).toMatchObject({ name: 'Ulaanbaatar', country: 'MN' });
    expect(ub.bbox!.minLat).toBeLessThan(ub.lat);
    expect(ub.bbox!.maxLon).toBeGreaterThan(ub.lon);
  });

  it('/health reports provider, cache stats and dispatcher', async () => {
    ({ app } = await makeApp());
    await app.inject('/api/v1/weather?lat=1&lon=1');
    await app.inject('/api/v1/weather?lat=1&lon=1');
    const h = (await app.inject('/api/v1/health')).json();
    expect(h).toMatchObject({ status: 'ok', provider: 'mock (mock)', cache: { hits: 1 } });
    expect(h.cache.size).toBeGreaterThan(0);
    expect(h.cache.misses).toBeGreaterThanOrEqual(1);
    expect(h.notifications.dispatcher).toMatchObject({ enabled: false, runs: 0 });
  });

  it('/openapi.json describes every route', async () => {
    ({ app } = await makeApp());
    const spec = (await app.inject('/api/v1/openapi.json')).json();
    expect(spec.openapi).toMatch(/^3\./);
    for (const p of ['/weather', '/air', '/compare', '/nation', '/regions', '/regions/{id}/alerts', '/predict', '/devices', '/devices/{id}', '/devices/{id}/notifications', '/devices/{id}/test-notification', '/locations/search', '/locations/reverse', '/health']) {
      expect(spec.paths[p], p).toBeDefined();
    }
  });
});

describe('validation → 400 BAD_REQUEST', () => {
  it.each([
    '/api/v1/weather',
    '/api/v1/weather?lat=47.9',
    '/api/v1/weather?lat=91&lon=0',
    '/api/v1/weather?lat=-90.01&lon=0',
    '/api/v1/air?lat=0&lon=180.5',
    '/api/v1/air?lat=abc&lon=1',
    '/api/v1/air?lat=&lon=1',
    '/api/v1/compare?lat=1&lon=1&models=ecmwf,foo',
    '/api/v1/nation?region=mars',
    '/api/v1/locations/search',
    '/api/v1/locations/search?q=',
    `/api/v1/locations/search?q=${'x'.repeat(101)}`,
    '/api/v1/locations/search?q=seoul&limit=0',
    '/api/v1/locations/reverse?lat=1',
    '/api/v1/predict?lat=1&lon=1&hours=0',
  ])('%s', async (url) => {
    ({ app } = await makeApp());
    const r = await app.inject(url);
    expect(r.statusCode).toBe(400);
    const body = r.json<ApiError>();
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message.length).toBeGreaterThan(0);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('accepts boundary values', async () => {
    ({ app } = await makeApp());
    expect((await app.inject('/api/v1/weather?lat=-90&lon=180')).statusCode).toBe(200);
    expect((await app.inject('/api/v1/locations/search?q=a')).statusCode).toBe(200);
    expect((await app.inject(`/api/v1/locations/search?q=${'x'.repeat(100)}`)).statusCode).toBe(200);
  });

  it('gives a readable message', async () => {
    ({ app } = await makeApp());
    expect((await app.inject('/api/v1/weather?lat=91&lon=0')).json<ApiError>().error.message).toBe('lat must be between -90 and 90');
  });

  it('unknown routes → 404 NOT_FOUND', async () => {
    ({ app } = await makeApp());
    const r = await app.inject('/api/v1/nope');
    expect(r.statusCode).toBe(404);
    expect(r.json<ApiError>().error.code).toBe('NOT_FOUND');
  });
});

describe('auto mode: upstream 429 falls back to mock transparently', () => {
  it('/weather, /compare, /nation, /air and search answer 200 with meta.mock=true', async () => {
    ({ app } = await makeApp({ PROVIDER_MODE: 'auto' }, { live: failingProviders() }));
    for (const url of ['/api/v1/weather?lat=47.92&lon=106.92', '/api/v1/compare?lat=37.57&lon=126.98', '/api/v1/nation?region=kr', '/api/v1/air?lat=37.57&lon=126.98', '/api/v1/locations/search?q=seoul']) {
      const r = await app.inject(url);
      expect(r.statusCode, url).toBe(200);
      expect(r.json<ApiResponse<unknown>>().meta, url).toMatchObject({ mock: true, stale: false, provider: 'mock' });
    }
    const h = (await app.inject('/api/v1/health')).json();
    expect(h.provider).toBe('auto (open-meteo → mock)');
    expect(h.upstream.forecast.fallbacks).toBeGreaterThanOrEqual(1);
    expect(h.upstream.forecast.lastError).toMatch(/429/);
  });

  it('uses live data when the upstream works (recorded fixtures)', async () => {
    const { fetch } = fixtureFetch();
    ({ app } = await makeApp({ PROVIDER_MODE: 'auto' }, { fetch, clock: () => RECORDED_AT }));
    const body = (await app.inject('/api/v1/weather?lat=47.92&lon=106.92')).json<ApiResponse<TodayWeather>>();
    expect(body.meta).toMatchObject({ provider: 'open-meteo', mock: false });
    expect(body.data.current.temperature).toBe(1.4);
    expect(body.data.air!.pm25).toBe(64.5);
  });

  it('serves the last real value as STALE rather than replacing it with mock data', async () => {
    let t = RECORDED_AT.getTime();
    const { fetch } = fixtureFetch();
    let up = true;
    const flaky = async (u: string, i?: RequestInit) => {
      if (!up) return new Response(JSON.stringify({ error: true, reason: 'Daily API request limit exceeded' }), { status: 429 });
      return fetch(u);
    };
    ({ app } = await makeApp({ PROVIDER_MODE: 'auto', CACHE_TTL_WEATHER: '600' }, { fetch: flaky, clock: () => new Date(t) }));
    const first = await app.inject('/api/v1/weather?lat=47.92&lon=106.92');
    expect(first.json().meta.mock).toBe(false);
    up = false;
    t += 601_000;
    const second = await app.inject('/api/v1/weather?lat=47.92&lon=106.92');
    expect(second.statusCode).toBe(200);
    expect(second.headers['x-cache']).toBe('STALE');
    expect(second.json().meta).toMatchObject({ stale: true, mock: false, provider: 'open-meteo' });
  });

  it('air failure during /weather yields air: null, not a 500 (live mode)', async () => {
    const { fetch } = fixtureFetch();
    const air = failingProviders().air;
    ({ app } = await makeApp({ PROVIDER_MODE: 'live' }, { fetch, clock: () => RECORDED_AT, live: { air } }));
    const r = await app.inject('/api/v1/weather?lat=47.92&lon=106.92');
    expect(r.statusCode).toBe(200);
    expect(r.json<ApiResponse<TodayWeather>>().data.air).toBeNull();
  });
});

describe('live mode errors', () => {
  it('upstream 429 with nothing cached → 503 UPSTREAM_UNAVAILABLE', async () => {
    ({ app } = await makeApp({ PROVIDER_MODE: 'live' }, { live: failingProviders() }));
    const r = await app.inject('/api/v1/weather?lat=47.92&lon=106.92');
    expect(r.statusCode).toBe(503);
    expect(r.json<ApiError>().error.code).toBe('UPSTREAM_UNAVAILABLE');
  });

  it('unexpected errors → 500 INTERNAL without leaking details', async () => {
    const bug = failingProviders(() => new TypeError('secret stack detail'));
    ({ app } = await makeApp({ PROVIDER_MODE: 'live' }, { live: bug }));
    const r = await app.inject('/api/v1/air?lat=1&lon=1');
    expect(r.statusCode).toBe(500);
    expect(r.json<ApiError>()).toEqual({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  });

  it('client errors from upstream are not masked by the fallback', async () => {
    const bad = failingProviders(() => new UpstreamError('open-meteo', 'client', 'HTTP 400 — bad param', 400));
    ({ app } = await makeApp({ PROVIDER_MODE: 'auto' }, { live: bad }));
    expect((await app.inject('/api/v1/weather?lat=1&lon=1')).statusCode).toBe(502);
  });
});

describe('cross-cutting HTTP behaviour', () => {
  it('rate limits per IP with RATE_LIMITED', async () => {
    ({ app } = await makeApp({ RATE_LIMIT_MAX: '3' }));
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await app.inject('/api/v1/regions')).statusCode);
    expect(codes).toEqual([200, 200, 200, 429]);
    const r = await app.inject('/api/v1/regions');
    expect(r.json<ApiError>().error.code).toBe('RATE_LIMITED');
    expect((await app.inject('/api/v1/health')).statusCode).toBe(200); // health is exempt
  });

  it('applies the CORS allow-list and exposes X-Cache', async () => {
    ({ app } = await makeApp({ CORS_ORIGIN: 'http://localhost:8080' }));
    const ok = await app.inject({ url: '/api/v1/regions', headers: { origin: 'http://localhost:8080' } });
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    expect(String(ok.headers['access-control-expose-headers'])).toMatch(/X-Cache/);
    const other = await app.inject({ url: '/api/v1/regions', headers: { origin: 'http://evil.test' } });
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('echoes a request id', async () => {
    ({ app } = await makeApp());
    const r = await app.inject({ url: '/api/v1/health', headers: { 'x-request-id': 'abc-123' } });
    expect(r.headers['x-request-id']).toBe('abc-123');
  });
});
