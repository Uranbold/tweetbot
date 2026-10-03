import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiGet, buildUrl, errorMessage } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds URLs under /api/v1 and drops empty params', () => {
    expect(buildUrl('/weather', { lat: '47.92', lon: 106.92, x: undefined, y: '' })).toBe('/api/v1/weather?lat=47.92&lon=106.92');
  });

  it('returns the envelope including meta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { data: { ok: 1 }, meta: { provider: 'mock', fetchedAt: 'x', stale: false, mock: true } })));
    const res = await apiGet<{ ok: number }>('/health');
    expect(res.data.ok).toBe(1);
    expect(res.meta.mock).toBe(true);
  });

  it('maps ApiError bodies to ApiRequestError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(503, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'down' } })));
    const err = await apiGet('/predict').catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.status).toBe(503);
    expect(err.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(err.retryable).toBe(true);
    expect(errorMessage(err)).toMatch(/temporarily unavailable/);
  });

  it('treats 400 as non-retryable and network failures as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(400, { error: { code: 'BAD_REQUEST', message: 'bad lat' } })));
    const bad = await apiGet('/weather').catch((e) => e);
    expect(bad.retryable).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('failed'))));
    const net = await apiGet('/weather').catch((e) => e);
    expect(net.code).toBe('NETWORK');
    expect(net.retryable).toBe(true);
  });
});
