import { describe, expect, it } from 'vitest';
import { AIR_GRADE_COLORS, DEFAULT_SCALE, gradeColor, gradeForValue, gradeLabel, worseGrade } from './air';
import { gaugePosition } from '../components/charts/Gauge';

describe('air grade colours', () => {
  it('uses Naver-style blue / green / orange / red', () => {
    expect(gradeColor('good')).toBe('#3a8bff');
    expect(gradeColor('moderate')).toBe(AIR_GRADE_COLORS.moderate);
    expect(gradeColor('bad')).toBe('#f58a1f');
    expect(gradeColor('very-bad')).toBe('#e5484d');
    expect(new Set(Object.values(AIR_GRADE_COLORS)).size).toBe(4);
  });

  it('falls back to a neutral colour and "No data" label', () => {
    expect(gradeColor(null)).toBe('var(--text-muted)');
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
