import { describe, expect, it } from 'vitest';
import { deriveAlerts, maxRollingSum, severityAtLeast, type AlertDay, type AlertHour, type AlertInput } from '../../src/domain/alerts.js';
import { addHours } from '../../src/lib/time.js';

const hours = (n: number, f: (i: number) => Partial<AlertHour> = () => ({})): AlertHour[] =>
  Array.from({ length: n }, (_, i) => ({ time: addHours('2026-10-01T00:00', i), precipitation: 0, snowfall: 0, windSpeed: 3, windGust: 6, ...f(i) }));

const days = (vals: [min: number, feelsMax: number][]): AlertDay[] =>
  vals.map(([temperatureMin, feelsLikeMax], i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, temperatureMin, feelsLikeMax }));

const run = (o: Partial<AlertInput>) =>
  deriveAlerts({ hourly: hours(72), daily: days([[10, 20], [10, 20], [10, 20], [10, 20]]), fromDate: '2026-10-01', toDate: '2026-10-04', ...o });
const only = (o: Partial<AlertInput>) => run(o).map((a) => `${a.type}:${a.severity}`);

describe('BR-02 derived alerts', () => {
  it('returns nothing for benign weather', () => {
    expect(run({})).toEqual([]);
  });

  describe('heat wave', () => {
    it('advisory at feels-like ≥ 33 on 2 consecutive days', () => {
      expect(only({ daily: days([[20, 33], [20, 33.5], [20, 28], [20, 28]]) })).toEqual(['heat-wave:advisory']);
    });
    it('no alert for a single hot day or non-consecutive days', () => {
      expect(only({ daily: days([[20, 36], [20, 30], [20, 36], [20, 30]]) })).toEqual([]);
    });
    it('warning at ≥ 35 for 2 days, spanning the whole run', () => {
      const [a] = run({ daily: days([[20, 34], [20, 35], [20, 36], [20, 35.2]]) });
      expect(a).toMatchObject({ type: 'heat-wave', severity: 'warning', start: '2026-10-02T00:00', end: '2026-10-05T00:00', source: 'derived', title: 'Heat wave warning' });
    });
    it('just below the threshold does not trigger', () => {
      expect(only({ daily: days([[20, 32.9], [20, 32.9], [20, 20], [20, 20]]) })).toEqual([]);
    });
  });

  describe('cold wave', () => {
    it('advisory at morning min ≤ −12', () => {
      expect(only({ daily: days([[0, 5], [-12, 0], [0, 5], [0, 5]]) })).toEqual(['cold-wave:advisory']);
      expect(only({ daily: days([[-5, 5], [-11.9, 0], [-11, 5], [-5, 5]]) })).toEqual([]);
    });
    it('advisory on a ≥ 10 °C day-over-day drop', () => {
      const [a] = run({ daily: days([[8, 15], [-2, 5], [0, 5], [0, 5]]) });
      expect(a).toMatchObject({ type: 'cold-wave', severity: 'advisory', start: '2026-10-02T00:00' });
      expect(a!.description).toMatch(/drops 10/);
    });
    it('uses a past day for the drop but does not alert on past days', () => {
      const daily = [{ date: '2026-09-30', temperatureMin: 12, feelsLikeMax: 20 }, ...days([[1, 10], [1, 10], [1, 10], [1, 10]])];
      expect(only({ daily })).toEqual(['cold-wave:advisory']);
      const pastOnly = [{ date: '2026-09-30', temperatureMin: -20, feelsLikeMax: 20 }, ...days([[1, 10], [1, 10], [1, 10], [1, 10]])];
      expect(only({ daily: pastOnly })).toEqual([]); // −20 °C yesterday is not alerted, and −20 → 1 is a rise
    });
    it('warning at min ≤ −15', () => {
      expect(only({ daily: days([[-5, 0], [-15, -8], [-5, 0], [-5, 0]]) })).toEqual(['cold-wave:warning']);
    });
    it('ignores days outside the evaluation window', () => {
      expect(only({ daily: days([[0, 5], [0, 5], [0, 5], [0, 5], [-30, -20]]) })).toEqual([]);
    });
  });

  describe('heavy rain', () => {
    it('advisory at ≥ 60 mm / 3 h', () => {
      const [a] = run({ hourly: hours(72, (i) => ({ precipitation: i >= 10 && i < 13 ? 20 : 0 })) });
      expect(a).toMatchObject({ type: 'heavy-rain', severity: 'advisory', start: '2026-10-01T10:00', end: '2026-10-01T12:59' });
    });
    it('advisory at ≥ 110 mm / 12 h even when no 3 h window reaches 60', () => {
      expect(only({ hourly: hours(72, (i) => ({ precipitation: i < 12 ? 9.2 : 0 })) })).toEqual(['heavy-rain:advisory']);
    });
    it('warning at ≥ 90 mm / 3 h or ≥ 180 mm / 12 h', () => {
      expect(only({ hourly: hours(72, (i) => ({ precipitation: i < 3 ? 30 : 0 })) })).toEqual(['heavy-rain:warning']);
      expect(only({ hourly: hours(72, (i) => ({ precipitation: i < 12 ? 15 : 0 })) })).toEqual(['heavy-rain:warning']);
    });
    it('59.9 mm in 3 h is not enough', () => {
      expect(only({ hourly: hours(72, (i) => ({ precipitation: i < 3 ? 19.96 : 0 })) })).toEqual([]);
    });
  });

  describe('heavy snow', () => {
    it('advisory at ≥ 5 cm / 24 h, warning at ≥ 20 cm', () => {
      expect(only({ hourly: hours(72, (i) => ({ snowfall: i < 10 ? 0.5 : 0 })) })).toEqual(['heavy-snow:advisory']);
      expect(only({ hourly: hours(72, (i) => ({ snowfall: i < 20 ? 1 : 0 })) })).toEqual(['heavy-snow:warning']);
      expect(only({ hourly: hours(72, (i) => ({ snowfall: i % 24 < 4 ? 1 : 0 })) })).toEqual([]);
    });
  });

  describe('strong wind', () => {
    it.each([
      [14, 15, 'strong-wind:advisory'], [10, 20, 'strong-wind:advisory'], [21, 22, 'strong-wind:warning'], [15, 26, 'strong-wind:warning'], [13.9, 19.9, null],
    ])('wind %d / gust %d → %s', (wind, gust, expected) => {
      const r = only({ hourly: hours(72, (i) => (i === 30 ? { windSpeed: wind, windGust: gust } : {})) });
      expect(r).toEqual(expected ? [expected] : []);
    });
  });

  describe('fine dust', () => {
    const air = (grades: string[]) => grades.map((g, i) => ({ time: addHours('2026-10-01T00:00', i), grade: g as 'good' }));
    it('advisory when "bad" is sustained for ≥ 2 h', () => {
      expect(only({ air: air(['good', 'bad', 'bad', 'moderate']) })).toEqual(['fine-dust:advisory']);
      expect(only({ air: air(['good', 'bad', 'moderate', 'bad']) })).toEqual([]);
    });
    it('warning when "very bad" is sustained', () => {
      const [a] = run({ air: air(['bad', 'very-bad', 'very-bad', 'very-bad', 'good']) });
      expect(a).toMatchObject({ type: 'fine-dust', severity: 'warning', start: '2026-10-01T01:00', end: '2026-10-01T03:59' });
    });
    it('handles a run that lasts to the end of the series and missing air data', () => {
      expect(only({ air: air(['good', 'bad', 'bad']) })).toEqual(['fine-dust:advisory']);
      expect(only({ air: null })).toEqual([]);
    });
  });

  it('sorts warnings before advisories', () => {
    const r = run({
      daily: days([[0, 5], [-12, 0], [0, 5], [0, 5]]),
      hourly: hours(72, (i) => (i === 5 ? { windSpeed: 25, windGust: 30 } : {})),
    });
    expect(r.map((a) => a.severity)).toEqual(['warning', 'advisory']);
  });

  it('severityAtLeast', () => {
    expect(severityAtLeast('warning', 'advisory')).toBe(true);
    expect(severityAtLeast('advisory', 'warning')).toBe(false);
  });

  it('maxRollingSum finds the wettest window', () => {
    const w = maxRollingSum(hours(10, (i) => ({ precipitation: [0, 1, 5, 2, 0, 0, 3, 3, 3, 0][i] })), 3, (h) => h.precipitation);
    expect(w).toEqual({ sum: 9, start: 6, end: 8 });
  });
});
