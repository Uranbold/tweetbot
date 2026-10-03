/**
 * Solar position (NOAA simplified algorithm, ~1 minute accuracy). Used by the mock
 * provider (sunrise/sunset, day/night, UV) and to flag day/night in model comparisons.
 */
import { formatLocal, parseLocal } from '../lib/time.js';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

function dayOfYear(date: Date): number {
  return Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
}

/** Equation of time (minutes) and declination (radians) for a fractional year. */
function solarParams(date: Date) {
  const g = ((2 * Math.PI) / 365) * (dayOfYear(date) - 1 + (date.getUTCHours() - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  return { eqTime, decl };
}

/** Solar elevation angle in degrees at a UTC instant. */
export function solarElevation(lat: number, lon: number, instant: Date): number {
  const { eqTime, decl } = solarParams(instant);
  const minutes = instant.getUTCHours() * 60 + instant.getUTCMinutes() + instant.getUTCSeconds() / 60;
  const tst = minutes + eqTime + 4 * lon; // true solar time, minutes
  const ha = rad(tst / 4 - 180);
  const cosZen = Math.sin(rad(lat)) * Math.sin(decl) + Math.cos(rad(lat)) * Math.cos(decl) * Math.cos(ha);
  return 90 - deg(Math.acos(Math.max(-1, Math.min(1, cosZen))));
}

export interface SunTimes {
  sunrise: string; // local wall clock
  sunset: string;
  /** 'normal' | 'polar-day' (sun never sets) | 'polar-night' (never rises). */
  kind: 'normal' | 'polar-day' | 'polar-night';
}

/** Sunrise/sunset as local wall-clock strings for a local date at a fixed UTC offset. */
export function sunTimes(lat: number, lon: number, date: string, utcOffsetSeconds: number): SunTimes {
  const noonUtc = new Date(parseLocal(date).getTime() + 12 * 3_600_000);
  const { eqTime, decl } = solarParams(noonUtc);
  const cosHa = (Math.cos(rad(90.833)) - Math.sin(rad(lat)) * Math.sin(decl)) / (Math.cos(rad(lat)) * Math.cos(decl));
  const midnight = parseLocal(date).getTime();
  const at = (utcMinutes: number) => formatLocal(new Date(midnight + (utcMinutes * 60 + utcOffsetSeconds) * 1000));
  const solarNoonUtc = 720 - 4 * lon - eqTime;
  if (cosHa > 1) return { sunrise: at(solarNoonUtc), sunset: at(solarNoonUtc), kind: 'polar-night' };
  if (cosHa < -1) return { sunrise: `${date}T00:00`, sunset: `${date}T23:59`, kind: 'polar-day' };
  const ha = deg(Math.acos(cosHa));
  return { sunrise: at(solarNoonUtc - 4 * ha), sunset: at(solarNoonUtc + 4 * ha), kind: 'normal' };
}

/** Daylight per Open-Meteo's is_day definition (sun above the horizon incl. refraction). */
export function isDaylight(lat: number, lon: number, instant: Date): boolean {
  return solarElevation(lat, lon, instant) > -0.833;
}
