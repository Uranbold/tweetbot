/**
 * Formatting helpers. All forecast times in the contract are *local wall-clock* strings for the
 * location ("2026-10-01T14:00"), so we parse their components directly instead of going through
 * `Date` in the browser's timezone — this keeps labels correct in the location's timezone.
 */

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/;

export function parseWallClock(iso: string): WallClock {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Invalid local time: ${iso}`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] ? Number(m[4]) : 0,
    minute: m[5] ? Number(m[5]) : 0,
  };
}

/** "YYYY-MM-DD" part of a local ISO string. */
export const datePart = (iso: string): string => iso.slice(0, 10);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayNumber(date: string): number {
  const { year, month, day } = parseWallClock(date);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD" or local ISO). */
export function daysBetween(from: string, to: string): number {
  return Math.round(dayNumber(datePart(to)) - dayNumber(datePart(from)));
}

export function weekdayShort(date: string): string {
  const { year, month, day } = parseWallClock(date);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function isWeekend(date: string): boolean {
  const w = weekdayShort(date);
  return w === 'Sat' || w === 'Sun';
}

/** "Oct 3" */
export function formatMonthDay(date: string): string {
  const { month, day } = parseWallClock(date);
  return `${MONTHS[month - 1]} ${day}`;
}

/** "Today" / "Tomorrow" / weekday, relative to `today` ("YYYY-MM-DD"). */
export function relativeDayLabel(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return weekdayShort(date);
}

/** "2 PM", "12 AM" */
export function formatHour(iso: string): string {
  const { hour } = parseWallClock(iso);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "07:13" */
export function formatClock(iso: string): string {
  const { hour, minute } = parseWallClock(iso);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function minutesOfDay(iso: string): number {
  const { hour, minute } = parseWallClock(iso);
  return hour * 60 + minute;
}

/** Rounds and avoids "-0". */
export function roundTemp(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  const r = Math.round(value * f) / f;
  return Object.is(r, -0) ? 0 : r;
}

/** "11°", "-3°", or "11.4°" with decimals=1. Tables pass unit "°C" (UX §6). */
export function formatTemp(value: number | null | undefined, decimals = 0, unit: '°' | '°C' = '°'): string {
  if (value == null || Number.isNaN(value)) return '–';
  return `${roundTemp(value, decimals).toFixed(decimals)}${unit}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '–';
  return `${Math.round(value)}%`;
}

/** "0.4mm"; values under 0.1 shown as "0". */
export function formatPrecip(mm: number): string {
  if (mm < 0.05) return '0';
  return mm < 10 ? mm.toFixed(1) : String(Math.round(mm));
}

export function formatWindSpeed(ms: number): string {
  return `${roundTemp(ms, 1).toFixed(1)} m/s`;
}

const COMPASS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Meteorological degrees (direction the wind comes FROM) → 16-point compass label. */
export function windDirectionLabel(degrees: number): string {
  const d = ((degrees % 360) + 360) % 360;
  return COMPASS16[Math.round(d / 22.5) % 16];
}

/** Rotation for an up-pointing arrow so it points where the wind is blowing TO. */
export function windArrowRotation(degrees: number): number {
  return (((degrees + 180) % 360) + 360) % 360;
}

/** "11h 39m" between two local ISO times. */
export function formatDuration(fromIso: string, toIso: string): string {
  const mins = Math.max(0, minutesOfDay(toIso) - minutesOfDay(fromIso) + daysBetween(fromIso, toIso) * 1440);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

/**
 * Sun progress across the day: 0 at sunrise, 1 at sunset, <0 before sunrise, >1 after sunset.
 */
export function sunProgress(nowIso: string, sunriseIso: string, sunsetIso: string): number {
  const now = minutesOfDay(nowIso) + daysBetween(sunriseIso, nowIso) * 1440;
  const rise = minutesOfDay(sunriseIso);
  const set = minutesOfDay(sunsetIso) + daysBetween(sunriseIso, sunsetIso) * 1440;
  if (set <= rise) return 0;
  return (now - rise) / (set - rise);
}

/** Formats a UTC instant (e.g. meta.fetchedAt) as HH:mm in the given IANA timezone. */
export function formatInstantClock(utcIso: string, timeZone?: string): string {
  const d = new Date(utcIso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  }
}

export function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`;
}
