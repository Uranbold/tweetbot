import { describe, expect, it } from 'vitest';
import { codeSeverity, conditionFromWmo, conditionSeverity, isPrecipitating, mostSevereCode } from '../../src/domain/wmo.js';

describe('conditionFromWmo', () => {
  it.each([
    [0, 'clear'], [1, 'mostly-clear'], [2, 'partly-cloudy'], [3, 'cloudy'], [45, 'fog'], [48, 'fog'],
    [51, 'drizzle'], [55, 'drizzle'], [56, 'freezing-rain'], [61, 'rain'], [63, 'rain'], [65, 'heavy-rain'],
    [66, 'freezing-rain'], [67, 'freezing-rain'], [71, 'snow'], [73, 'snow'], [75, 'heavy-snow'], [77, 'snow'],
    [80, 'rain'], [81, 'rain'], [82, 'heavy-rain'], [85, 'snow'], [86, 'heavy-snow'], [95, 'thunderstorm'],
    [96, 'thunderstorm'], [99, 'thunderstorm'], [68, 'sleet'], [83, 'sleet'],
  ])('maps %i → %s', (code, key) => {
    expect(conditionFromWmo(code).key).toBe(key);
  });

  it('keeps the code and isDay flag, and labels clear nights', () => {
    expect(conditionFromWmo(2, false)).toEqual({ code: 2, key: 'partly-cloudy', label: 'Partly cloudy', isDay: false });
    expect(conditionFromWmo(0, true).label).toBe('Clear');
    expect(conditionFromWmo(0, false).label).toBe('Clear night');
  });

  it('falls back by WMO decade for codes outside the Open-Meteo subset', () => {
    expect(conditionFromWmo(10).key).toBe('fog');
    expect(conditionFromWmo(58).key).toBe('drizzle');
    expect(conditionFromWmo(62).key).toBe('rain');
    expect(conditionFromWmo(92).key).toBe('thunderstorm');
    expect(conditionFromWmo(Number.NaN).key).toBe('cloudy');
    expect(conditionFromWmo(150).code).toBe(99);
  });
});

describe('severity', () => {
  it('orders conditions from clear to thunderstorm', () => {
    expect(conditionSeverity('clear')).toBeLessThan(conditionSeverity('cloudy'));
    expect(conditionSeverity('rain')).toBeLessThan(conditionSeverity('heavy-rain'));
    expect(conditionSeverity('heavy-snow')).toBeLessThan(conditionSeverity('thunderstorm'));
    expect(codeSeverity(63)).toBeGreaterThan(codeSeverity(61));
  });

  it('picks the most severe code', () => {
    expect(mostSevereCode([0, 3, 61, 2])).toBe(61);
    expect(mostSevereCode([61, 95, 75])).toBe(95);
    expect(mostSevereCode([])).toBeUndefined();
  });

  it('classifies precipitation', () => {
    expect(isPrecipitating('drizzle')).toBe(true);
    expect(isPrecipitating('fog')).toBe(false);
  });
});
