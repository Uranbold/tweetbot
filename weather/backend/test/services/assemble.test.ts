import { describe, expect, it } from 'vitest';
import { assembleAirReport, assembleComparison, assembleToday } from '../../src/services/assemble.js';
import { parseAirQuality, parseForecast, parseModels } from '../../src/providers/openmeteo/parse.js';
import { reverseFromCatalog } from '../../src/providers/catalog.js';
import { RECORDED_AT, fixture } from '../helpers/fixtures.js';

const forecast = parseForecast(fixture('forecast-ulaanbaatar.json'));
const air = parseAirQuality(fixture('air-quality-ulaanbaatar.json'));
const location = reverseFromCatalog({ lat: 47.92, lon: 106.92 }, RECORDED_AT);

describe('assembleToday (recorded Ulaanbaatar data)', () => {
  const t = assembleToday(forecast, air, location);

  it('starts the 48 h strip at the current hour and returns 10 days from today', () => {
    expect(t.hourly).toHaveLength(48);
    expect(t.hourly[0]!.time).toBe('2026-10-01T22:00');
    expect(t.daily).toHaveLength(10);
    expect(t.daily[0]!.date).toBe('2026-10-01');
    expect(t.daily[9]!.date).toBe('2026-10-10');
  });

  it('compares with the same hour yesterday', () => {
    const raw = fixture<any>('forecast-ulaanbaatar.json');
    const yesterday = raw.hourly.temperature_2m[raw.hourly.time.indexOf('2026-09-30T22:00')];
    expect(t.comparison.temperatureDiff).toBeCloseTo(Math.round((1.4 - yesterday) * 10) / 10, 5);
  });

  it('fills current conditions incl. compass label, visibility and UV from the hour', () => {
    expect(t.current).toMatchObject({ time: '2026-10-01T22:15', temperature: 1.4, windDirectionLabel: 'E', uvIndex: 0 });
    expect(t.current.condition).toEqual({ code: 2, key: 'partly-cloudy', label: 'Partly cloudy', isDay: false });
    expect(t.current.visibility).toBeGreaterThan(1);
  });

  it('provides today summary, headline, AM/PM, air, indices, clothing', () => {
    expect(t.today).toMatchObject({ temperatureMin: -2.6, temperatureMax: 9.4, sunrise: '2026-10-01T06:51', sunset: '2026-10-01T18:32' });
    expect(t.today.headline.length).toBeGreaterThan(5);
    expect(t.daily[0]!.am.condition.isDay).toBe(true);
    expect(t.air).toMatchObject({ pm10: 65.2, pm25: 64.5, pm10Grade: 'moderate', pm25Grade: 'bad', overallGrade: 'bad', usAqi: 73 });
    expect(t.lifeIndices.map((i) => i.key)).toEqual(expect.arrayContaining(['uv', 'laundry', 'car-wash', 'clothing', 'outdoor-activity', 'food-poisoning', 'wind-chill']));
    expect(t.clothing.items).toContain('Padded coat');
    for (const a of t.alerts) expect(a.source).toBe('derived');
  });

  it('works without air data', () => {
    const noAir = assembleToday(forecast, null, location);
    expect(noAir.air).toBeNull();
    expect(noAir.alerts.some((a) => a.type === 'fine-dust')).toBe(false);
    expect(noAir.lifeIndices.find((i) => i.key === 'outdoor-activity')).toBeDefined();
  });
});

describe('assembleAirReport', () => {
  it('returns 72 h from the current hour, 4 daily worst grades and the scale', () => {
    const r = assembleAirReport(air, location);
    expect(r.hourly[0]!.time).toBe('2026-10-01T22:00');
    expect(r.hourly.length).toBeLessThanOrEqual(72);
    expect(r.hourly.length).toBeGreaterThanOrEqual(72);
    expect(r.daily.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    for (const d of r.daily) expect(['good', 'moderate', 'bad', 'very-bad']).toContain(d.pm25Grade);
    expect(r.scale.pm10).toHaveLength(4);
  });
});

describe('assembleComparison', () => {
  it('labels models, slices from now and computes consensus', () => {
    const d = parseModels(fixture('compare-ulaanbaatar.json'), ['ecmwf', 'gfs', 'kma']);
    const c = assembleComparison(d, location, RECORDED_AT);
    expect(c.models.map((m) => [m.model, m.label])).toEqual([['ecmwf', 'ECMWF IFS'], ['gfs', 'NOAA GFS']]);
    expect(c.models[0]!.hourly[0]!.time).toBe('2026-10-01T22:00');
    expect(c.models[0]!.hourly[0]!.condition.isDay).toBe(false);
    expect(c.consensus[0]).toEqual({ date: '2026-10-01', temperatureMaxMean: 8.4, temperatureMaxSpread: 1.7, precipitationSumMean: 0, agreement: 'high' });
    expect(c.consensus[1]!.agreement).toBe('high');
  });
});
