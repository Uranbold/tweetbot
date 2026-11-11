import { describe, expect, it } from 'vitest';
import { isDaylight, solarElevation, sunTimes } from '../../src/domain/sun.js';

const minutes = (local: string) => Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));

describe('sun', () => {
  it('matches Open-Meteo sunrise/sunset for Ulaanbaatar on 2026-10-01 within 3 minutes', () => {
    const s = sunTimes(47.9086, 106.8657, '2026-10-01', 28800);
    expect(s.kind).toBe('normal');
    expect(Math.abs(minutes(s.sunrise) - minutes('2026-10-01T06:51'))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutes(s.sunset) - minutes('2026-10-01T18:32'))).toBeLessThanOrEqual(3);
  });

  it('gives longer days in summer than winter (northern hemisphere) and the reverse in the south', () => {
    const len = (lat: number, date: string) => {
      const s = sunTimes(lat, 0, date, 0);
      return minutes(s.sunset) - minutes(s.sunrise);
    };
    expect(len(50, '2026-06-21')).toBeGreaterThan(len(50, '2026-12-21') + 300);
    expect(len(-35, '2026-06-21')).toBeLessThan(len(-35, '2026-12-21'));
  });

  it('handles polar day and night', () => {
    expect(sunTimes(78, 15, '2026-06-21', 7200).kind).toBe('polar-day');
    expect(sunTimes(78, 15, '2026-12-21', 3600).kind).toBe('polar-night');
  });

  it('computes elevation and daylight', () => {
    expect(solarElevation(0, 0, new Date('2026-03-20T12:00:00Z'))).toBeGreaterThan(85);
    expect(isDaylight(37.57, 126.98, new Date('2026-10-01T03:00:00Z'))).toBe(true); // noon KST
    expect(isDaylight(37.57, 126.98, new Date('2026-10-01T15:00:00Z'))).toBe(false); // midnight KST
  });
});
