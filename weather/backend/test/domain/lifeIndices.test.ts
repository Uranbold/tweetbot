import { describe, expect, it } from 'vitest';
import {
  carWashIndex, computeLifeIndices, foodPoisoningIndex, heatIndexIndex, laundryIndex, outdoorActivityIndex, uvIndex, windChillIndex,
  type LifeIndexInput,
} from '../../src/domain/lifeIndices.js';
import { heatIndex, windChill } from '../../src/domain/feelsLike.js';

const base: LifeIndexInput = {
  temperature: 20, humidity: 50, windSpeed: 3, uvIndexMax: 4,
  next12hMaxPrecipProbability: 0, next12hMeanHumidity: 40, next12hMeanWind: 3, next12hMeanCloudCover: 10,
  next48hPrecipitationSum: 0, next48hMaxPrecipProbability: 0,
  next24hMaxTemperature: 22, humidityAtMaxTemperature: 40, todayMaxTemperature: 22, todayMeanHumidity: 50, airGrade: 'good',
};
const input = (o: Partial<LifeIndexInput>) => ({ ...base, ...o });

describe('UV (WHO bands)', () => {
  it.each([
    [0, 'low'], [2.9, 'low'], [3, 'moderate'], [5.9, 'moderate'], [6, 'high'], [7.9, 'high'], [8, 'very-high'], [10.9, 'very-high'], [11, 'very-high'],
  ])('%d → %s', (uv, level) => expect(uvIndex(uv).level).toBe(level));

  it('distinguishes extreme in the advice', () => {
    expect(uvIndex(12).advice).toMatch(/Extreme/);
  });
});

describe('laundry', () => {
  it('is excellent when dry, sunny and breezy', () => {
    expect(laundryIndex(base).level).toBe('very-high');
  });
  it('is very low when rain is likely', () => {
    expect(laundryIndex(input({ next12hMaxPrecipProbability: 80 })).level).toBe('very-low');
  });
  it('degrades with humidity and cloud', () => {
    const humid = laundryIndex(input({ next12hMeanHumidity: 90, next12hMeanCloudCover: 90 }));
    expect(['low', 'very-low', 'moderate']).toContain(humid.level);
    expect(humid.value!).toBeLessThan(laundryIndex(base).value!);
  });
});

describe('car wash (48 h precipitation)', () => {
  it.each([
    [0, 0, 'very-high'], [0.8, 40, 'high'], [2, 60, 'moderate'], [5, 80, 'low'], [25, 100, 'very-low'],
  ])('%d mm / %d %% → %s', (sum, pop, level) => {
    expect(carWashIndex(input({ next48hPrecipitationSum: sum, next48hMaxPrecipProbability: pop })).level).toBe(level);
  });
});

describe('outdoor activity', () => {
  it('is good in mild clean air', () => {
    expect(outdoorActivityIndex(base).level).toBe('very-high');
  });
  it('is penalised by bad air, with mask advice', () => {
    const r = outdoorActivityIndex(input({ airGrade: 'very-bad' }));
    expect(['very-low', 'low']).toContain(r.level);
    expect(r.advice).toMatch(/KF94/);
  });
  it('is penalised by extreme temperatures and rain', () => {
    expect(outdoorActivityIndex(input({ temperature: -15 })).value!).toBeLessThan(50);
    expect(outdoorActivityIndex(input({ next12hMaxPrecipProbability: 90 })).advice).toMatch(/Rain/);
  });
  it('works without air data', () => {
    expect(outdoorActivityIndex(input({ airGrade: null })).level).toBe('very-high');
  });
});

describe('food poisoning', () => {
  it.each([
    [32, 75, 'very-high'], [27, 65, 'high'], [21, 40, 'moderate'], [12, 50, 'low'], [5, 90, 'very-low'],
  ])('%d°C %d%% → %s', (t, rh, level) => {
    expect(foodPoisoningIndex(input({ todayMaxTemperature: t, todayMeanHumidity: rh })).level).toBe(level);
  });
});

describe('heat index (only when T ≥ 27 °C)', () => {
  it('is absent below 27 °C', () => {
    expect(heatIndexIndex(input({ next24hMaxTemperature: 26.9 }))).toBeNull();
  });
  it('is present at 27 °C and grows with humidity', () => {
    const dry = heatIndexIndex(input({ next24hMaxTemperature: 33, humidityAtMaxTemperature: 30 }))!;
    const wet = heatIndexIndex(input({ next24hMaxTemperature: 33, humidityAtMaxTemperature: 80 }))!;
    expect(dry).not.toBeNull();
    expect(wet.value!).toBeGreaterThan(dry.value!);
    expect(['high', 'very-high']).toContain(wet.level);
  });
  it('matches the NWS table (32 °C, 70 % ≈ 40 °C)', () => {
    expect(heatIndex(32, 70)).toBeGreaterThan(38);
    expect(heatIndex(32, 70)).toBeLessThan(42);
  });
});

describe('wind chill (only when T ≤ 10 °C and wind > 1.3 m/s)', () => {
  it('is absent when warm or calm', () => {
    expect(windChillIndex(input({ temperature: 10.1, windSpeed: 5 }))).toBeNull();
    expect(windChillIndex(input({ temperature: 0, windSpeed: 1.3 }))).toBeNull();
  });
  it('is present at the boundary and matches the Environment Canada formula', () => {
    expect(windChillIndex(input({ temperature: 10, windSpeed: 1.4 }))).not.toBeNull();
    // −20 °C at 30 km/h ≈ −32.6 (EC table)
    expect(windChill(-20, 30 / 3.6)).toBeCloseTo(-32.6, 0);
    expect(windChillIndex(input({ temperature: -20, windSpeed: 30 / 3.6 }))!.level).toBe('high');
  });
});

describe('computeLifeIndices', () => {
  it('returns the six core indices plus conditional ones', () => {
    expect(computeLifeIndices(base).map((i) => i.key)).toEqual(['uv', 'laundry', 'car-wash', 'clothing', 'outdoor-activity', 'food-poisoning']);
    const cold = computeLifeIndices(input({ temperature: -5, windSpeed: 6 })).map((i) => i.key);
    expect(cold).toContain('wind-chill');
    expect(cold).not.toContain('heat-index');
    const hot = computeLifeIndices(input({ temperature: 30, next24hMaxTemperature: 31 })).map((i) => i.key);
    expect(hot).toContain('heat-index');
  });
  it('maps clothing level to the BR-04 band', () => {
    const clothing = computeLifeIndices(input({ temperature: 0 })).find((i) => i.key === 'clothing')!;
    expect(clothing.level).toBe('very-low');
    expect(clothing.advice).toMatch(/Padded coat/);
  });
});
