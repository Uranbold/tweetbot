import { describe, expect, it } from 'vitest';
import { splitHalfDays, summarizeHalf } from '../../src/domain/halfday.js';

const h = (hour: number, code: number, pop = 0, date = '2026-10-01') => ({
  time: `${date}T${String(hour).padStart(2, '0')}:00`,
  weatherCode: code,
  precipitationProbability: pop,
});

describe('BR-07 AM/PM split', () => {
  it('splits at 12:00 and picks the most severe condition per half', () => {
    const hours = [
      ...Array.from({ length: 12 }, (_, i) => h(i, i === 9 ? 61 : 1, i === 9 ? 70 : 10)),
      ...Array.from({ length: 12 }, (_, i) => h(12 + i, i === 3 ? 3 : 0, 5)),
    ];
    const { am, pm } = splitHalfDays(hours, '2026-10-01');
    expect(am.condition.key).toBe('rain');
    expect(am.precipitationProbability).toBe(70);
    expect(pm.condition.key).toBe('cloudy');
    expect(pm.precipitationProbability).toBe(5);
  });

  it('11:00 belongs to AM and 12:00 to PM', () => {
    const { am, pm } = splitHalfDays([h(11, 95, 90), h(12, 71, 40)], '2026-10-01');
    expect(am.condition.key).toBe('thunderstorm');
    expect(pm.condition.key).toBe('snow');
  });

  it('ignores hours from other days', () => {
    const { am } = splitHalfDays([h(3, 65, 100, '2026-10-02'), h(3, 0, 0)], '2026-10-01');
    expect(am.condition.key).toBe('clear');
  });

  it('uses day icons and the fallback code for empty windows', () => {
    expect(summarizeHalf([], 2)).toEqual({ condition: { code: 2, key: 'partly-cloudy', label: 'Partly cloudy', isDay: true }, precipitationProbability: 0 });
  });
});
