import { describe, expect, it } from 'vitest';
import { linearScale, rangeBarGeometry, weekExtent } from './range';

describe('weekly range bar maths', () => {
  it('scales a day to the week extent', () => {
    expect(rangeBarGeometry(0, 10, -10, 20)).toEqual({ left: 33.33, width: 33.33 });
    expect(rangeBarGeometry(-10, 20, -10, 20)).toEqual({ left: 0, width: 100 });
  });

  it('keeps a minimum visible width without overflowing', () => {
    expect(rangeBarGeometry(5, 5, 0, 10)).toEqual({ left: 50, width: 4 });
    expect(rangeBarGeometry(10, 10, 0, 10)).toEqual({ left: 96, width: 4 });
  });

  it('handles swapped or out-of-range inputs and zero spans', () => {
    expect(rangeBarGeometry(10, 0, -10, 20)).toEqual({ left: 33.33, width: 33.33 });
    expect(rangeBarGeometry(-50, 50, 0, 10)).toEqual({ left: 0, width: 100 });
    expect(rangeBarGeometry(3, 3, 3, 3)).toEqual({ left: 0, width: 100 });
  });

  it('computes the week extent', () => {
    expect(weekExtent([
      { temperatureMin: -2, temperatureMax: 12 },
      { temperatureMin: -9, temperatureMax: 2 },
    ])).toEqual({ min: -9, max: 12 });
  });

  it('linear scale maps domain to range', () => {
    const s = linearScale(0, 10, 100, 0);
    expect(s(0)).toBe(100);
    expect(s(5)).toBe(50);
    expect(linearScale(1, 1, 0, 10)(1)).toBe(5);
  });
});
