import { describe, expect, it } from 'vitest';
import { buildHeadline, type HeadlineHour } from '../../src/domain/headline.js';
import { addHours } from '../../src/lib/time.js';

const series = (start: string, f: (i: number) => Partial<HeadlineHour>): HeadlineHour[] =>
  Array.from({ length: 24 }, (_, i) => ({ time: addHours(start, i), weatherCode: 0, precipitationProbability: 0, precipitation: 0, ...f(i) }));

describe('headline', () => {
  it('describes a dry day by its dominant sky', () => {
    expect(buildHeadline(series('2026-10-01T08:00', () => ({})))).toBe('Clear skies, staying dry');
    expect(buildHeadline(series('2026-10-01T08:00', (i) => ({ weatherCode: i < 16 ? 3 : 0 })))).toBe('Cloudy, staying dry');
  });

  it('announces rain arriving later today', () => {
    const h = series('2026-10-01T09:00', (i) => (i >= 9 ? { weatherCode: 61, precipitationProbability: 70, precipitation: 1 } : {}));
    expect(buildHeadline(h)).toBe('Clear skies, rain likely after 6 PM');
  });

  it('marks precipitation that starts tomorrow', () => {
    const h = series('2026-10-01T20:00', (i) => (i >= 8 ? { weatherCode: 73, precipitationProbability: 80, precipitation: 1 } : { weatherCode: 2 }));
    expect(buildHeadline(h)).toBe('Partly cloudy, snow likely after 4 AM tomorrow');
  });

  it('describes ongoing rain easing off', () => {
    const h = series('2026-10-01T10:00', (i) => (i < 5 ? { weatherCode: 63, precipitationProbability: 90, precipitation: 3 } : { weatherCode: 3 }));
    expect(buildHeadline(h)).toBe('Rain easing around 3 PM, then cloudy');
  });

  it('describes all-day precipitation and wind', () => {
    const h = series('2026-10-01T10:00', () => ({ weatherCode: 95, precipitationProbability: 90, precipitation: 5, windSpeed: 12 }));
    expect(buildHeadline(h)).toBe('Thunderstorms continuing through the next 24 hours, windy at times');
  });

  it('ignores unlikely precipitation codes', () => {
    const h = series('2026-10-01T10:00', (i) => (i === 3 ? { weatherCode: 51, precipitationProbability: 20, precipitation: 0.1 } : {}));
    expect(buildHeadline(h)).toBe('Clear skies, staying dry');
  });

  it('handles an empty series', () => {
    expect(buildHeadline([])).toBe('Forecast unavailable');
  });
});
