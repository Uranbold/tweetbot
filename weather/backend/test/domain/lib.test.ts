import { describe, expect, it } from 'vitest';
import { coordKey, coordLabel, compassLabel, haversineKm } from '../../src/lib/geo.js';
import { addDays, addHours, floorHour, hourLabel, instantOf, localTimeAt, tzOffsetSeconds } from '../../src/lib/time.js';
import { chunk, mapLimit } from '../../src/lib/concurrency.js';

describe('time helpers', () => {
  it('does wall-clock arithmetic across day/month/year boundaries', () => {
    expect(addHours('2026-12-31T23:00', 1)).toBe('2027-01-01T00:00');
    expect(addHours('2026-10-01T05:00', -24)).toBe('2026-09-30T05:00');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(floorHour('2026-10-01T22:45')).toBe('2026-10-01T22:00');
  });
  it('converts between instants and local time', () => {
    expect(localTimeAt(new Date('2026-10-01T14:15:00Z'), 28800)).toBe('2026-10-01T22:15');
    expect(instantOf('2026-10-01T22:15', 28800).toISOString()).toBe('2026-10-01T14:15:00.000Z');
  });
  it('reads IANA offsets including DST', () => {
    expect(tzOffsetSeconds('Asia/Seoul')).toBe(32400);
    expect(tzOffsetSeconds('Europe/London', new Date('2026-07-01T00:00:00Z'))).toBe(3600);
    expect(tzOffsetSeconds('Europe/London', new Date('2026-01-01T00:00:00Z'))).toBe(0);
    expect(tzOffsetSeconds('Not/AZone')).toBe(0);
  });
  it('labels hours', () => {
    expect(['2026-10-01T00:00', '2026-10-01T09:00', '2026-10-01T12:00', '2026-10-01T18:00'].map(hourLabel)).toEqual(['midnight', '9 AM', 'noon', '6 PM']);
  });
});

describe('geo helpers', () => {
  it('formats coordinates', () => {
    expect(coordKey(37.5665, 126.978)).toBe('37.57,126.98');
    expect(coordLabel(37.5665, 126.978)).toBe('37.57°N 126.98°E');
    expect(coordLabel(-33.87, -70.65)).toBe('33.87°S 70.65°W');
  });
  it('computes distances and compass points', () => {
    expect(haversineKm({ lat: 37.566, lon: 126.978 }, { lat: 35.1017, lon: 129.03 })).toBeCloseTo(325, -1);
    expect([0, 22.5, 45, 180, 315, 359, -45].map(compassLabel)).toEqual(['N', 'NNE', 'NE', 'S', 'NW', 'N', 'NW']);
  });
});

describe('concurrency', () => {
  it('maps with bounded concurrency, preserving order', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([5, 1, 3, 2, 4], 2, async (x) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, x));
      active--;
      return x * 10;
    });
    expect(out).toEqual([50, 10, 30, 20, 40]);
    expect(peak).toBe(2);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
