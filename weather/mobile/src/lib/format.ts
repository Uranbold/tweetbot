import type { Locale } from '@/i18n/types';

/**
 * Contract times are ISO-8601 *local wall-clock* strings for the location ("2026-10-01T14:00").
 * We therefore parse them as plain wall-clock values and never apply the device timezone.
 */
export interface WallClock {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
}

export function parseWallClock(iso: string): WallClock | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] ? Number(m[4]) : 0,
    minute: m[5] ? Number(m[5]) : 0,
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "14:00" (mn/ko) or "2 PM" (en). */
export function formatHour(iso: string, locale: Locale = 'en'): string {
  const wc = parseWallClock(iso);
  if (!wc) return iso;
  if (locale === 'en') {
    const h12 = wc.hour % 12 === 0 ? 12 : wc.hour % 12;
    return `${h12}${wc.hour < 12 ? 'AM' : 'PM'}`;
  }
  if (locale === 'ko') return `${wc.hour}시`;
  return `${pad2(wc.hour)}:${pad2(wc.minute)}`;
}

/** "14:05" 24h clock regardless of locale (for sunrise/sunset and timestamps). */
export function formatClock(iso: string): string {
  const wc = parseWallClock(iso);
  if (!wc) return iso;
  return `${pad2(wc.hour)}:${pad2(wc.minute)}`;
}

const WEEKDAYS: Record<Locale, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  mn: ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'],
  ko: ['일', '월', '화', '수', '목', '금', '토'],
};

export function weekdayOf(dateIso: string): number {
  const wc = parseWallClock(dateIso);
  if (!wc) return 0;
  return new Date(Date.UTC(wc.year, wc.month - 1, wc.day)).getUTCDay();
}

/** "Today" / "Tomorrow" / weekday abbreviation relative to `todayIso` (location-local date). */
export function formatDayLabel(
  dateIso: string,
  todayIso: string,
  locale: Locale = 'en',
  labels: { today: string; tomorrow: string },
): string {
  const a = parseWallClock(dateIso);
  const b = parseWallClock(todayIso);
  if (a && b) {
    const da = Date.UTC(a.year, a.month - 1, a.day);
    const db = Date.UTC(b.year, b.month - 1, b.day);
    const diff = Math.round((da - db) / 86_400_000);
    if (diff === 0) return labels.today;
    if (diff === 1) return labels.tomorrow;
  }
  return WEEKDAYS[locale][weekdayOf(dateIso)] ?? dateIso;
}

/** "10/1" style short date. */
export function formatShortDate(dateIso: string): string {
  const wc = parseWallClock(dateIso);
  if (!wc) return dateIso;
  return `${wc.month}/${wc.day}`;
}

/** Relative time for notification history ("3m ago"), using the device clock (sentAt is UTC). */
export function formatRelative(utcIso: string, now: number = Date.now()): string {
  const t = Date.parse(utcIso);
  if (Number.isNaN(t)) return utcIso;
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 60) return 'now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function roundTemp(t: number): string {
  const r = Math.round(t);
  return `${r === 0 ? 0 : r}°`;
}

export function signedTemp(t: number): string {
  const r = Math.round(t * 10) / 10;
  if (r === 0) return '0°';
  return `${r > 0 ? '+' : '−'}${Math.abs(r)}°`;
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Meteorological degrees ("from") → 16-point compass label. */
export function windDirectionLabel(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  return DIRS[Math.round(norm / 22.5) % 16] ?? 'N';
}

export function formatPercent(p: number): string {
  return `${Math.round(p)}%`;
}

export function formatProbability(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** Hour label for pickers: "07:00". */
export function hourLabel(h: number): string {
  return `${pad2(h)}:00`;
}
