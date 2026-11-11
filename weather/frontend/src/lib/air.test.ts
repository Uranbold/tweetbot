import { describe, expect, it } from 'vitest';
import { AIR_GRADE_COLORS, AIR_GRADE_HEX, DEFAULT_SCALE, gradeColor, gradeForValue, gradeLabel, worseGrade } from './air';
import { gaugePosition } from '../components/charts/Gauge';

describe('air grade colours', () => {
  it('maps grades to theme tokens backed by the UX §3.3 hex values (blue / green / orange / red)', () => {
    expect(gradeColor('good')).toBe('var(--grade-good)');
    expect(gradeColor('moderate')).toBe(AIR_GRADE_COLORS.moderate);
    expect(gradeColor('bad')).toBe('var(--grade-bad)');
    expect(gradeColor('very-bad')).toBe('var(--grade-very-bad)');
    expect(new Set(Object.values(AIR_GRADE_COLORS)).size).toBe(4);
    expect(AIR_GRADE_HEX.light).toEqual({ good: '#2a78d6', moderate: '#1a9e4b', bad: '#e0860a', 'very-bad': '#c7322e' });
    expect(AIR_GRADE_HEX.dark['very-bad']).toBe('#e05a52');
  });

  it('falls back to a neutral colour and "No data" label', () => {
    expect(gradeColor(null)).toBe('var(--fg-3)');
    expect(gradeLabel(undefined)).toBe('No data');
    expect(gradeLabel('very-bad')).toBe('Very bad');
  });

  it('grades values with the supplied scale (inclusive bands, open top)', () => {
    expect(gradeForValue(0, DEFAULT_SCALE.pm10)).toBe('good');
    expect(gradeForValue(30, DEFAULT_SCALE.pm10)).toBe('good');
    expect(gradeForValue(31, DEFAULT_SCALE.pm10)).toBe('moderate');
    expect(gradeForValue(150, DEFAULT_SCALE.pm10)).toBe('bad');
    expect(gradeForValue(600, DEFAULT_SCALE.pm10)).toBe('very-bad');
    expect(gradeForValue(16, DEFAULT_SCALE.pm25)).toBe('moderate');
  });

  it('picks the worse grade', () => {
    expect(worseGrade('good', 'bad')).toBe('bad');
    expect(worseGrade('very-bad', 'moderate')).toBe('very-bad');
  });

  it('places values on the gauge with one quarter per grade', () => {
    expect(gaugePosition(0, DEFAULT_SCALE.pm10)).toBe(0);
    expect(gaugePosition(30, DEFAULT_SCALE.pm10)).toBeCloseTo(0.25);
    expect(gaugePosition(80, DEFAULT_SCALE.pm10)).toBeCloseTo(0.5);
    expect(gaugePosition(46, DEFAULT_SCALE.pm10)).toBeGreaterThan(0.25);
    expect(gaugePosition(46, DEFAULT_SCALE.pm10)).toBeLessThan(0.5);
    expect(gaugePosition(9999, DEFAULT_SCALE.pm10)).toBe(1);
  });
});
