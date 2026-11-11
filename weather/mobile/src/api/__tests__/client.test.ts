import type { ApiResponse, Region } from '@contract';
import { ApiClientError, createClient, describeError } from '../client';
import { resetFixtureState } from '@/__fixtures__/handler';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('api client', () => {
  it('unwraps {data, meta} and builds the URL with query params', async () => {
    const fetchFn = jest.fn(async () =>
      jsonResponse({ data: { ok: true }, meta: { provider: 'open-meteo', fetchedAt: 'x', stale: false, mock: false } }),
    );
    const client = createClient({ baseUrl: 'http://api.test/v1/', fetchFn, useFixtures: false });
    const res = await client.getWeather({ lat: 47.92, lon: 106.92 });
    expect(res.data).toEqual({ ok: true });
    expect(res.meta.provider).toBe('open-meteo');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/weather?lat=47.92&lon=106.92');
    expect(init.method).toBe('GET');
  });

  it('serialises JSON bodies for POST/PATCH', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ data: { id: 'd1' }, meta: { provider: 'mock', fetchedAt: '', stale: false, mock: true } }));
    const client = createClient({ baseUrl: 'http://api.test', fetchFn, useFixtures: false });
    await client.patchDevice('d1', { regionIds: ['kr-seoul'] });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/devices/d1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ regionIds: ['kr-seoul'] });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('maps {error:{code,message}} to ApiClientError', async () => {
    const fetchFn = jest.fn(async () => jsonResponse({ error: { code: 'BAD_REQUEST', message: 'lat out of range' } }, 400));
    const client = createClient({ baseUrl: 'http://api.test', fetchFn, useFixtures: false });
    await expect(client.getWeather({ lat: 999, lon: 0 })).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'BAD_REQUEST',
      message: 'lat out of range',
      status: 400,
    });
  });

  it('maps network failures to NETWORK and unknown HTTP errors to INTERNAL', async () => {
    const down = createClient({ baseUrl: 'http://api.test', useFixtures: false, fetchFn: jest.fn(async () => { throw new Error('ECONNREFUSED'); }) });
    await expect(down.getRegions()).rejects.toMatchObject({ code: 'NETWORK', status: 0 });

    const html = createClient({ baseUrl: 'http://api.test', useFixtures: false, fetchFn: jest.fn(async () => ({ ok: false, status: 502, json: async () => { throw new Error('nope'); } }) as unknown as Response) });
    await expect(html.getRegions()).rejects.toMatchObject({ code: 'INTERNAL', status: 502 });
  });

  it('rejects a 200 without the envelope as PARSE', async () => {
    const client = createClient({ baseUrl: 'http://api.test', useFixtures: false, fetchFn: jest.fn(async () => jsonResponse([{ id: 'x' }])) });
    await expect(client.getRegions()).rejects.toMatchObject({ code: 'PARSE' });
  });

  it('treats 204 as void (DELETE /devices/:id)', async () => {
    const fetchFn = jest.fn(async () => ({ ok: true, status: 204, json: async () => { throw new Error('no body'); } }) as unknown as Response);
    const client = createClient({ baseUrl: 'http://api.test', fetchFn, useFixtures: false });
    await expect(client.deleteDevice('d1')).resolves.toBeUndefined();
  });

  it('describeError gives friendly copy', () => {
    expect(describeError(new ApiClientError('NETWORK', 'x', 0))).toMatch(/Cannot reach/);
    expect(describeError(new ApiClientError('RATE_LIMITED', 'x', 429))).toMatch(/Too many/);
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});

describe('fixture mode', () => {
  beforeEach(() => resetFixtureState());
  const client = createClient({ useFixtures: true });

  it('serves regions, weather, predict with meta.mock = true', async () => {
    const regions = await client.getRegions();
    expect(regions.meta.mock).toBe(true);
    expect(regions.data.some((r: Region) => r.id === 'mn-ulaanbaatar')).toBe(true);
    const weather = await client.getWeather({ lat: 1, lon: 2 });
    expect(weather.data.hourly).toHaveLength(48);
    expect(weather.data.daily).toHaveLength(10);
    const predict = await client.getPredict({ lat: 1, lon: 2 });
    expect(predict.data.hourly).toHaveLength(72);
    expect(predict.data.model.name).toBe('skycast-gbr-v1');
  });

  it('upserts devices by pushToken and round-trips PATCH', async () => {
    const reg = {
      pushToken: 'ExponentPushToken[t1]',
      platform: 'android' as const,
      regionIds: ['mn-ulaanbaatar'],
      followLocation: false,
      preferences: { alertTypes: [], minSeverity: 'advisory' as const, aiRiskThreshold: 0.6, dailyBriefingHour: null, airGradeThreshold: 'bad' as const, quietHours: null, locale: 'en' as const },
    };
    const a = await client.registerDevice(reg);
    const b = await client.registerDevice({ ...reg, regionIds: ['kr-seoul'] });
    expect(b.data.id).toBe(a.data.id);
    expect(b.data.regionIds).toEqual(['kr-seoul']);
    const patched = await client.patchDevice(a.data.id, { followLocation: true });
    expect(patched.data.followLocation).toBe(true);
    const fetched = await client.getDevice(a.data.id);
    expect(fetched.data.followLocation).toBe(true);
    await expect(client.getRegionAlerts('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const history = await client.getNotifications(a.data.id);
    expect(history.data.length).toBeGreaterThan(0);
    const test = await client.sendTestNotification(a.data.id);
    expect(test.data.kind).toBe('test');
    expect(test.data.deepLink).toMatch(/^skycast:\/\/region\//);
  });

  it('typed envelope shape matches ApiResponse', async () => {
    const res: ApiResponse<Region[]> = await client.getRegions();
    expect(Object.keys(res).sort()).toEqual(['data', 'meta']);
  });
});
