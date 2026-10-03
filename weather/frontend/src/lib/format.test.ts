import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  formatClock,
  formatDuration,
  formatHour,
  formatInstantClock,
  formatMonthDay,
  formatPrecip,
  formatTemp,
  parseWallClock,
  relativeDayLabel,
  sunProgress,
  weekdayShort,
  windArrowRotation,
  windDirectionLabel,
} from './format';

describe('wall-clock parsing', () => {
  it('parses local ISO strings without applying the browser timezone', () => {
    expect(parseWallClock('2026-10-01T14:05')).toEqual({ year: 2026, month: 10, day: 1, hour: 14, minute: 5 });
    expect(parseWallClock('2026-10-01')).toMatchObject({ hour: 0, minute: 0 });
    expect(() => parseWallClock('nope')).toThrow();
  });

  it('formats hours as 12-hour labels', () => {
    expect(formatHour('2026-10-01T00:00')).toBe('12 AM');
    expect(formatHour('2026-10-01T09:00')).toBe('9 AM');
    expect(formatHour('2026-10-01T12:00')).toBe('12 PM');
    expect(formatHour('2026-10-01T23:00')).toBe('11 PM');
    expect(formatClock('2026-10-01T07:03')).toBe('07:03');
  });

  it('computes day labels and weekdays across month boundaries', () => {
    expect(weekdayShort('2026-10-01')).toBe('Thu');
    expect(daysBetween('2026-09-30', '2026-10-02T05:00')).toBe(2);
    expect(relativeDayLabel('2026-10-01', '2026-10-01')).toBe('Today');
    expect(relativeDayLabel('2026-10-02', '2026-10-01')).toBe('Tomorrow');
    expect(relativeDayLabel('2026-10-03', '2026-10-01')).toBe('Sat');
    expect(formatMonthDay('2026-10-03')).toBe('Oct 3');
  });
});

describe('number formatting', () => {
  it('formats temperatures and never shows -0', () => {
    expect(formatTemp(11.44)).toBe('11°');
    expect(formatTemp(11.44, 1)).toBe('11.4°');
    expect(formatTemp(-0.3)).toBe('0°');
    expect(formatTemp(-3.6)).toBe('-4°');
    expect(formatTemp(null)).toBe('–');
  });

  it('formats precipitation', () => {
    expect(formatPrecip(0)).toBe('0');
    expect(formatPrecip(0.04)).toBe('0');
    expect(formatPrecip(1.25)).toBe('1.3');
    expect(formatPrecip(12.4)).toBe('12');
  });
});

describe('wind', () => {
  it('maps degrees to 16-point compass labels', () => {
    expect(windDirectionLabel(0)).toBe('N');
    expect(windDirectionLabel(359)).toBe('N');
    expect(windDirectionLabel(45)).toBe('NE');
    expect(windDirectionLabel(305)).toBe('NW');
    expect(windDirectionLabel(-90)).toBe('W');
  });

  it('points the arrow downwind (from + 180°)', () => {
    expect(windArrowRotation(0)).toBe(180);
    expect(windArrowRotation(270)).toBe(90);
  });
});

describe('sun', () => {
  it('computes progress between sunrise and sunset', () => {
    expect(sunProgress('2026-10-01T07:00', '2026-10-01T07:00', '2026-10-01T19:00')).toBe(0);
    expect(sunProgress('2026-10-01T13:00', '2026-10-01T07:00', '2026-10-01T19:00')).toBe(0.5);
    expect(sunProgress('2026-10-01T21:00', '2026-10-01T07:00', '2026-10-01T19:00')).toBeGreaterThan(1);
    expect(sunProgress('2026-10-01T05:00', '2026-10-01T07:00', '2026-10-01T19:00')).toBeLessThan(0);
    expect(formatDuration('2026-10-01T07:13', '2026-10-01T18:52')).toBe('11h 39m');
  });

  it('formats UTC instants in the location timezone', () => {
    expect(formatInstantClock('2026-10-01T06:00:00Z', 'Asia/Ulaanbaatar')).toBe('14:00');
    expect(formatInstantClock('2026-10-01T06:00:00Z', 'America/New_York')).toBe('02:00');
  });
});
