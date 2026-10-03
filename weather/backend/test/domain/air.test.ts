import { describe, expect, it } from 'vitest';
import { airScale, gradeAtLeast, overallGrade, pm10Grade, pm25Grade, usAqiFromPm25, worseGrade } from '../../src/domain/air.js';

describe('BR-01 air grades', () => {
  it.each([
    [0, 'good'], [30, 'good'], [30.4, 'good'], [30.5, 'moderate'], [31, 'moderate'], [80, 'moderate'],
    [81, 'bad'], [150, 'bad'], [151, 'very-bad'], [999, 'very-bad'],
  ])('PM10 %d → %s', (v, g) => expect(pm10Grade(v)).toBe(g));

  it.each([
    [0, 'good'], [15, 'good'], [16, 'moderate'], [35, 'moderate'], [36, 'bad'], [75, 'bad'], [76, 'very-bad'],
  ])('PM2.5 %d → %s', (v, g) => expect(pm25Grade(v)).toBe(g));

  it('treats negative sensor noise as good', () => {
    expect(pm25Grade(-3)).toBe('good');
  });

  it('overall grade is the worse of the two', () => {
    expect(overallGrade(20, 40)).toBe('bad');
    expect(overallGrade(160, 10)).toBe('very-bad');
    expect(overallGrade(10, 10)).toBe('good');
    expect(worseGrade('moderate', 'good')).toBe('moderate');
    expect(gradeAtLeast('bad', 'bad')).toBe(true);
    expect(gradeAtLeast('moderate', 'bad')).toBe(false);
  });

  it('exports a contiguous scale for UI legends', () => {
    const { pm10, pm25 } = airScale();
    for (const scale of [pm10, pm25]) {
      expect(scale.map((b) => b.grade)).toEqual(['good', 'moderate', 'bad', 'very-bad']);
      for (let i = 1; i < scale.length; i++) expect(scale[i]!.min).toBe(scale[i - 1]!.max! + 1);
      expect(scale.at(-1)!.max).toBeNull();
    }
    expect(pm25[1]).toEqual({ grade: 'moderate', min: 16, max: 35 });
  });

  it('computes US AQI from PM2.5 breakpoints', () => {
    expect(usAqiFromPm25(0)).toBe(0);
    expect(usAqiFromPm25(9)).toBe(50);
    expect(usAqiFromPm25(35.4)).toBe(100);
    expect(usAqiFromPm25(1000)).toBe(500);
  });
});
