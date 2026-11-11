import { describe, expect, it } from 'vitest';
import { MockAirProvider, MockGeocodingProvider, MockModelProvider, MockWeatherProvider } from '../../src/providers/mock/adapters.js';
import { conditionFromWmo, isPrecipitating, isSnowy } from '../../src/domain/wmo.js';
import { dateOf, hourOf } from '../../src/lib/time.js';

const NOW = new Date('2026-10-01T05:00:00Z');
const UB = { lat: 47.92, lon: 106.92 };
const SEOUL = { lat: 37.57, lon: 126.98 };
const wx = (now = NOW) => new MockWeatherProvider({ now: () => now });

describe('MockWeatherProvider', () => {
  it('is deterministic for the same coordinates and time', async () => {
    const a = await wx().getForecast(UB);
    const b = await wx().getForecast(UB);
    expect(a.value).toEqual(b.value);
    expect(a.source).toMatchObject({ provider: 'mock', mock: true });
  });

  it('differs between locations and is stable across nearby request times', async () => {
    const ub = (await wx().getForecast(UB)).value;
    const seoul = (await wx().getForecast(SEOUL)).value;
    expect(ub.hourly.map((h) => h.temperature)).not.toEqual(seoul.hourly.map((h) => h.temperature));
    // Same location 20 minutes later: the hourly values for shared hours are identical.
    const later = (await wx(new Date(NOW.getTime() + 20 * 60_000)).getForecast(UB)).value;
    expect(later.hourly.slice(0, 48)).toEqual(ub.hourly.slice(0, 48));
  });

  it('has the Open-Meteo shape: yesterday + 10 days, local times, real time zone', async () => {
    const f = (await wx().getForecast(SEOUL)).value;
    expect(f.place.timezone).toBe('Asia/Seoul');
    expect(f.place.utcOffsetSeconds).toBe(32400);
    expect(f.hourly).toHaveLength(264);
    expect(f.daily).toHaveLength(11);
    expect(f.hourly[0]!.time).toBe('2026-09-30T00:00');
    expect(f.daily[1]!.date).toBe('2026-10-01');
    expect(f.current.time).toBe('2026-10-01T14:00');
  });

  it('is physically plausible: diurnal cycle, seasons, latitude, elevation', async () => {
    const f = (await wx().getForecast(SEOUL)).value;
    const today = f.hourly.filter((h) => dateOf(h.time) === '2026-10-01');
    const warmest = today.reduce((a, h) => (h.temperature > a.temperature ? h : a));
    const coldest = today.reduce((a, h) => (h.temperature < a.temperature ? h : a));
    expect(hourOf(warmest.time)).toBeGreaterThanOrEqual(11);
    expect(hourOf(warmest.time)).toBeLessThanOrEqual(18);
    expect(hourOf(coldest.time) <= 8 || hourOf(coldest.time) >= 22).toBe(true);
    for (const d of f.daily) expect(d.temperatureMax).toBeGreaterThan(d.temperatureMin);

    const winter = (await wx(new Date('2026-01-15T05:00:00Z')).getForecast(UB)).value;
    const summer = (await wx(new Date('2026-07-15T05:00:00Z')).getForecast(UB)).value;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(winter.hourly.map((h) => h.temperature))).toBeLessThan(-10);
    expect(mean(summer.hourly.map((h) => h.temperature))).toBeGreaterThan(10);

    const equator = (await wx().getForecast({ lat: 1.29, lon: 103.85 })).value;
    expect(mean(equator.hourly.map((h) => h.temperature))).toBeGreaterThan(22);
  });

  it('keeps conditions coherent with precipitation and temperature', async () => {
    const all = [];
    for (const day of ['2026-01-10', '2026-04-10', '2026-07-10', '2026-10-10']) {
      for (const c of [UB, SEOUL, { lat: 51.5, lon: -0.13 }]) {
        all.push(...(await wx(new Date(`${day}T00:00:00Z`)).getForecast(c)).value.hourly);
      }
    }
    for (const h of all) {
      const key = conditionFromWmo(h.weatherCode).key;
      if (h.precipitation >= 0.1) {
        expect(isPrecipitating(key)).toBe(true);
        expect(h.precipitationProbability).toBeGreaterThanOrEqual(60);
      } else {
        expect(isPrecipitating(key)).toBe(false);
      }
      if (isSnowy(key)) expect(h.temperature).toBeLessThanOrEqual(0.5);
      if (h.snowfall > 0) expect(isSnowy(key)).toBe(true);
      expect(h.humidity).toBeGreaterThanOrEqual(0);
      expect(h.humidity).toBeLessThanOrEqual(100);
      if (!h.isDay) expect(h.uvIndex).toBe(0);
    }
    expect(all.some((h) => h.precipitation > 0)).toBe(true);
  });

  it('places sunrise/sunset plausibly for latitude and day of year', async () => {
    const f = (await wx().getForecast(UB)).value;
    const today = f.daily.find((d) => d.date === '2026-10-01')!;
    expect(today.sunrise.slice(11, 13)).toBe('06');
    expect(today.sunset.slice(11, 13)).toBe('18');
  });

  it('returns snapshots in input order', async () => {
    const s = (await wx().getSnapshots([UB, SEOUL])).value;
    expect(s).toHaveLength(2);
    expect(s[0]!.place.timezone).toBe('Asia/Ulaanbaatar');
    expect(s[1]!.place.timezone).toBe('Asia/Seoul');
    for (const x of s) expect(x.temperatureMax).toBeGreaterThanOrEqual(x.temperature - 0.5);
  });
});

describe('MockAirProvider', () => {
  it('is deterministic and seasonal (Ulaanbaatar winter smog)', async () => {
    const at = (iso: string) => new MockAirProvider({ now: () => new Date(iso) });
    const a = (await at('2026-01-15T05:00:00Z').getAirQuality(UB)).value;
    const b = (await at('2026-01-15T05:00:00Z').getAirQuality(UB)).value;
    expect(a).toEqual(b);
    expect(a.hourly).toHaveLength(96);
    const summer = (await at('2026-07-15T05:00:00Z').getAirQuality(UB)).value;
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(a.hourly.map((h) => h.pm25))).toBeGreaterThan(2 * avg(summer.hourly.map((h) => h.pm25)));
    for (const h of a.hourly) expect(h.pm10).toBeGreaterThanOrEqual(h.pm25);
    expect(a.current.usAqi).toBeGreaterThan(0);
  });
});

describe('MockModelProvider', () => {
  it('returns every requested model with distinct but correlated forecasts', async () => {
    const p = new MockModelProvider({ now: () => NOW });
    const r = (await p.getModels(SEOUL, ['ecmwf', 'gfs', 'jma'])).value;
    expect(r.models.map((m) => m.model)).toEqual(['ecmwf', 'gfs', 'jma']);
    const [e, g] = r.models;
    expect(e!.daily).toHaveLength(7);
    expect(e!.hourly.map((h) => h.temperature)).not.toEqual(g!.hourly.map((h) => h.temperature));
    const diff = Math.abs(e!.daily[0]!.temperatureMax - g!.daily[0]!.temperatureMax);
    expect(diff).toBeLessThan(5);
    expect(r.models[2]!.hourly[0]!.precipitationProbability).toBeNull();
  });
});

describe('MockGeocodingProvider', () => {
  it('searches the catalogue by name, alias and diacritics', async () => {
    const g = new MockGeocodingProvider({ now: () => NOW });
    expect((await g.search('seoul', 5)).value[0]!.name).toBe('Seoul');
    expect((await g.search('ulan bator', 5)).value[0]!.name).toBe('Ulaanbaatar');
    expect((await g.search('olgii', 5)).value[0]!.name).toBe('Ölgii');
    expect((await g.search('xyzzy', 5)).value).toEqual([]);
  });

  it('reverse-geocodes to the nearest city or an ad-hoc location', async () => {
    const g = new MockGeocodingProvider({ now: () => NOW });
    expect((await g.reverse(SEOUL)).value.id).toBe('1835848');
    const sea = (await g.reverse({ lat: 30.123, lon: 150.456 })).value;
    expect(sea).toMatchObject({ id: '30.12,150.46', name: '30.12°N 150.46°E', timezone: 'Etc/GMT-10', utcOffsetSeconds: 36000 });
  });
});
