import { describe, expect, it } from 'vitest';
import { compareWithYesterday } from '../../src/domain/comparison.js';

describe('BR-03 yesterday comparison', () => {
  it('reports warmer / cooler with one decimal', () => {
    expect(compareWithYesterday(12.3, 10)).toEqual({ temperatureDiff: 2.3, message: '2.3° warmer than yesterday' });
    expect(compareWithYesterday(9, 10)).toEqual({ temperatureDiff: -1, message: '1.0° cooler than yesterday' });
  });

  it('says "Same as yesterday" when |diff| < 0.5', () => {
    expect(compareWithYesterday(10.4, 10).message).toBe('Same as yesterday');
    expect(compareWithYesterday(9.6, 10).message).toBe('Same as yesterday');
    expect(compareWithYesterday(10, 10)).toEqual({ temperatureDiff: 0, message: 'Same as yesterday' });
  });

  it('treats exactly 0.5 as a difference', () => {
    expect(compareWithYesterday(10.5, 10).message).toBe('0.5° warmer than yesterday');
    expect(compareWithYesterday(-3, -2.5).message).toBe('0.5° cooler than yesterday');
  });

  it('rounds before comparing (floating point safety)', () => {
    expect(compareWithYesterday(0.3, 0.1).temperatureDiff).toBe(0.2);
  });

  it('handles a missing yesterday value', () => {
    expect(compareWithYesterday(5, undefined)).toEqual({ temperatureDiff: 0, message: 'No data for yesterday' });
  });
});
