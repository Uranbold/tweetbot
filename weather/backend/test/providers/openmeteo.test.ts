import { describe, expect, it } from 'vitest';
import { UpstreamError } from '../../src/errors.js';
import {
  OpenMeteoAirProvider, OpenMeteoGeocodingProvider, OpenMeteoModelProvider, OpenMeteoWeatherProvider,
} from '../../src/providers/openmeteo/adapters.js';
import { getJson } from '../../src/providers/openmeteo/http.js';
import { parseAirQuality, parseForecast, parseGeocoding, parseModels, parseSnapshots } from '../../src/providers/openmeteo/parse.js';
import { RATE_LIMITED_BODY, RECORDED_AT, fixture, fixtureFetch, jsonResponse } from '../helpers/fixtures.js';

const UB = { lat: 47.92, lon: 106.92 };

describe('forecast parsing (recorded Ulaanbaatar response)', () => {
  const f = parseForecast(fixture('forecast-ulaanbaatar.json'));

  it('maps place, current and units', () => {
    expect(f.place).toEqual({ latitude: 47.90861, longitude: 106.86567, timezone: 'Asia/Ulaanbaatar', utcOffsetSeconds: 28800, elevation: 1302 });
    expect(f.current).toMatchObject({ time: '2026-10-01T22:15', temperature: 1.4, feelsLike: -2.4, humidity: 78, weatherCode: 2, isDay: false, pressure: 1020.7, windSpeed: 2.46, windDirection: 84, windGust: 5.4 });
  });

  it('includes the previous day (past_days=1) and 10 forecast days', () => {
    expect(f.hourly).toHaveLength(264);
    expect(f.hourly[0]!.time).toBe('2026-09-30T00:00');
    expect(f.daily).toHaveLength(11);
    expect(f.daily[1]).toMatchObject({ date: '2026-10-01', temperatureMax: 9.4, temperatureMin: -2.6, sunrise: '2026-10-01T06:51', sunset: '2026-10-01T18:32' });
  });

  it('converts visibility from metres to km', () => {
    expect(f.hourly[0]!.visibility).toBeCloseTo(63.08, 2);
  });

  it('forward-fills nulls and rejects payloads without required columns', () => {
    const raw = fixture<Record<string, any>>('forecast-ulaanbaatar.json');
    raw.hourly.temperature_2m[5] = null;
    expect(parseForecast(raw).hourly[5]!.temperature).toBe(parseForecast(raw).hourly[4]!.temperature);
    delete raw.hourly.temperature_2m;
    expect(() => parseForecast(raw)).toThrow(UpstreamError);
    expect(() => parseForecast({ nope: true })).toThrow(/unexpected payload/);
  });
});

describe('multi-location snapshots (recorded 2-city response)', () => {
  it('parses an array response in order', () => {
    const s = parseSnapshots(fixture('snapshots-korea2.json'), 2);
    expect(s.map((x) => x.place.timezone)).toEqual(['Asia/Seoul', 'Asia/Seoul']);
    expect(s[0]).toMatchObject({ time: '2026-10-01T23:45', temperature: 13.7, weatherCode: 0, isDay: false });
    expect(typeof s[1]!.temperatureMin).toBe('number');
  });
  it('accepts a single-object response and checks the count', () => {
    const one = fixture<unknown[]>('snapshots-korea2.json')[0];
    expect(parseSnapshots(one, 1)).toHaveLength(1);
    expect(() => parseSnapshots(one, 2)).toThrow(/expected 2 locations/);
  });
});

describe('air-quality parsing (recorded Ulaanbaatar response)', () => {
  it('maps pollutant names and keeps the hourly series from local midnight', () => {
    const a = parseAirQuality(fixture('air-quality-ulaanbaatar.json'));
    expect(a.place.timezone).toBe('Asia/Ulaanbaatar');
    expect(a.current).toEqual({ time: '2026-10-01T22:00', pm10: 65.2, pm25: 64.5, o3: 14, no2: 48.4, so2: 60.7, co: 1319, usAqi: 73 });
    expect(a.hourly).toHaveLength(96);
    expect(a.hourly[0]!.time).toBe('2026-10-01T00:00');
  });
  it('falls back to the matching hourly value when current is missing a pollutant', () => {
    const raw = fixture<Record<string, any>>('air-quality-ulaanbaatar.json');
    const i = raw.hourly.time.indexOf('2026-10-01T22:00');
    raw.current.pm10 = null;
    expect(parseAirQuality(raw).current.pm10).toBe(raw.hourly.pm10[i]);
  });
});

describe('geocoding parsing (recorded "seoul" search)', () => {
  it('maps results to Locations with utc offsets', () => {
    const r = parseGeocoding(fixture('geocoding-seoul.json'), RECORDED_AT);
    expect(r[0]).toEqual({
      id: '1835848', name: 'Seoul', admin1: 'Seoul', country: 'South Korea', countryCode: 'KR',
      lat: 37.566, lon: 126.9784, timezone: 'Asia/Seoul', utcOffsetSeconds: 32400, elevation: 38,
    });
    expect(r).toHaveLength(3);
  });
  it('treats a response without results as empty and skips malformed entries', () => {
    expect(parseGeocoding({ generationtime_ms: 0.1 })).toEqual([]);
    expect(parseGeocoding({ results: [{ id: 'x' }, { id: 1, name: 'A', latitude: 1, longitude: 2 }] })).toHaveLength(1);
  });
});

describe('multi-model parsing', () => {
  it('reads model-suffixed keys and drops models without data at the location (recorded: KMA outside its domain)', () => {
    const d = parseModels(fixture('compare-ulaanbaatar.json'), ['ecmwf', 'gfs', 'kma']);
    expect(d.models.map((m) => m.model)).toEqual(['ecmwf', 'gfs']);
    const ecmwf = d.models[0]!;
    expect(ecmwf.hourly[0]).toEqual({ time: '2026-10-01T00:00', temperature: -2.5, precipitationProbability: 0, precipitation: 0, weatherCode: 0 });
    expect(ecmwf.daily[0]).toEqual({ date: '2026-10-01', temperatureMax: 9.2, temperatureMin: -3.1, precipitationSum: 0, weatherCode: 3 });
    expect(d.models[1]!.daily[1]).toMatchObject({ temperatureMax: 8.6, precipitationSum: 3.1, weatherCode: 55 });
  });

  it('accepts unsuffixed keys for a single model and null probability columns (hand-built fixture)', () => {
    const single = {
      latitude: 37.55, longitude: 127, timezone: 'Asia/Seoul', utc_offset_seconds: 32400, elevation: 27,
      hourly: { time: ['2026-10-01T00:00', '2026-10-01T01:00'], temperature_2m: [15.1, 14.8], precipitation_probability: [null, null], precipitation: [0, 0.4], weather_code: [null, 61] },
      daily: { time: ['2026-10-01'], temperature_2m_max: [22], temperature_2m_min: [13], precipitation_sum: [0.4], weather_code: [null] },
    };
    const d = parseModels(single, ['jma']);
    expect(d.models[0]!.hourly.map((h) => h.precipitationProbability)).toEqual([null, null]);
    expect(d.models[0]!.hourly[0]!.weatherCode).toBe(3);
    expect(d.models[0]!.daily[0]!.weatherCode).toBeNull();
  });
});

describe('adapters (fake fetch with recorded fixtures)', () => {
  it('requests the documented forecast parameters', async () => {
    const { fetch, calls } = fixtureFetch();
    const p = new OpenMeteoWeatherProvider({ timeoutMs: 1000, fetch, now: () => RECORDED_AT });
    const r = await p.getForecast(UB);
    expect(r.source).toEqual({ provider: 'open-meteo', mock: false, fetchedAt: RECORDED_AT.toISOString() });
    const url = new URL(calls[0]!);
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('past_days')).toBe('1');
    expect(url.searchParams.get('forecast_days')).toBe('10');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('hourly')).toContain('precipitation_probability');
    expect(calls[0]).toContain('current=temperature_2m,'); // literal commas
  });

  it('batches snapshot coordinates into one request', async () => {
    const { fetch, calls } = fixtureFetch();
    const p = new OpenMeteoWeatherProvider({ timeoutMs: 1000, fetch });
    const cs = Array.from({ length: 10 }, (_, i) => ({ lat: 40 + i, lon: 100 + i }));
    const r = await p.getSnapshots(cs);
    expect(r.value).toHaveLength(10);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0]!).searchParams.get('latitude')!.split(',')).toHaveLength(10);
  });

  it('splits large batches with bounded concurrency', async () => {
    const { fetch, calls } = fixtureFetch();
    const p = new OpenMeteoWeatherProvider({ timeoutMs: 1000, fetch, batchSize: 4, batchConcurrency: 2 });
    const r = await p.getSnapshots(Array.from({ length: 10 }, (_, i) => ({ lat: i, lon: i })));
    expect(r.value).toHaveLength(10);
    expect(calls).toHaveLength(3);
  });

  it('sends model ids and parses the comparison', async () => {
    const { fetch, calls } = fixtureFetch();
    const r = await new OpenMeteoModelProvider({ timeoutMs: 1000, fetch }).getModels(UB, ['ecmwf', 'gfs', 'kma']);
    expect(new URL(calls[0]!).searchParams.get('models')).toBe('ecmwf_ifs025,gfs_seamless,kma_seamless');
    expect(r.value.models).toHaveLength(2);
  });

  it('air quality: single and batch', async () => {
    const { fetch, calls } = fixtureFetch();
    const p = new OpenMeteoAirProvider({ timeoutMs: 1000, fetch });
    expect((await p.getAirQuality(UB)).value.current.pm25).toBe(64.5);
    expect(new URL(calls[0]!).searchParams.get('forecast_days')).toBe('4');
    const batch = await p.getCurrentBatch([UB, UB, UB]);
    expect(batch.value).toHaveLength(3);
    expect(batch.value[0]!.pm10).toBe(29.3);
  });

  it('geocoding: search via API, reverse via catalogue', async () => {
    const { fetch, calls } = fixtureFetch();
    const g = new OpenMeteoGeocodingProvider({ timeoutMs: 1000, fetch, now: () => RECORDED_AT });
    expect((await g.search('seoul', 2)).value.map((l) => l.name)).toEqual(['Seoul', 'Séouléo']);
    expect(new URL(calls[0]!).searchParams.get('language')).toBe('en');
    expect((await g.reverse(UB)).value.name).toBe('Ulaanbaatar');
    expect(calls).toHaveLength(1);
  });
});

describe('HTTP error mapping', () => {
  const opts = (fetch: (u: string, i?: RequestInit) => Promise<Response>, timeoutMs = 1000) => ({ fetch, timeoutMs, upstream: 'open-meteo forecast' });
  const caught = async (p: Promise<unknown>) => p.then(() => { throw new Error('expected failure'); }, (e: unknown) => e as UpstreamError);

  it('429 → rate-limited with the upstream reason', async () => {
    const e = await caught(getJson('https://x.test', opts(async () => jsonResponse(RATE_LIMITED_BODY, 429))));
    expect(e).toBeInstanceOf(UpstreamError);
    expect(e).toMatchObject({ kind: 'rate-limited', status: 429, code: 'UPSTREAM_UNAVAILABLE', statusCode: 503, transient: true });
    expect(e.message).toMatch(/Daily API request limit exceeded/);
  });

  it('5xx → server, 400 → client (not transient), bad JSON → parse', async () => {
    expect(await caught(getJson('https://x.test', opts(async () => new Response('oops', { status: 502 }))))).toMatchObject({ kind: 'server' });
    const client = await caught(getJson('https://x.test', opts(async () => jsonResponse({ error: true, reason: 'Invalid parameter' }, 400))));
    expect(client).toMatchObject({ kind: 'client', transient: false, statusCode: 502 });
    expect(await caught(getJson('https://x.test', opts(async () => new Response('{not json', { status: 200 }))))).toMatchObject({ kind: 'parse' });
  });

  it('times out with AbortController', async () => {
    const hang = (_u: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    const e = await caught(getJson('https://x.test', opts(hang, 20)));
    expect(e).toMatchObject({ kind: 'timeout' });
  });

  it('network failures → network', async () => {
    const e = await caught(getJson('https://x.test', opts(async () => { throw new TypeError('fetch failed'); })));
    expect(e).toMatchObject({ kind: 'network' });
  });
});
