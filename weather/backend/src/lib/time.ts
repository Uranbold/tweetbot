/**
 * Helpers for location-local wall-clock strings ("2026-10-01T14:00") as used by
 * Open-Meteo with timezone=auto. Arithmetic is done by treating the wall-clock
 * value as if it were UTC, which is exact for fixed offsets and avoids
 * depending on the host time zone.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function parseLocal(local: string): Date {
  const s = local.length === 10 ? `${local}T00:00` : local.slice(0, 16);
  return new Date(`${s}:00Z`);
}

export function formatLocal(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function formatDate(d: Date): string {
  return formatLocal(d).slice(0, 10);
}

export function addHours(local: string, hours: number): string {
  return formatLocal(new Date(parseLocal(local).getTime() + hours * 3_600_000));
}

export function addDays(date: string, days: number): string {
  return formatDate(new Date(parseLocal(date).getTime() + days * 86_400_000));
}

/** "2026-10-01T14:37" → "2026-10-01T14:00" */
export function floorHour(local: string): string {
  return `${local.slice(0, 13)}:00`;
}

export function dateOf(local: string): string {
  return local.slice(0, 10);
}

export function hourOf(local: string): number {
  return Number(local.slice(11, 13));
}

/** Local wall-clock time for an instant at a fixed UTC offset. */
export function localTimeAt(instant: Date, utcOffsetSeconds: number): string {
  return formatLocal(new Date(instant.getTime() + utcOffsetSeconds * 1000));
}

/** UTC instant for a local wall-clock string at a fixed UTC offset. */
export function instantOf(local: string, utcOffsetSeconds: number): Date {
  return new Date(parseLocal(local).getTime() - utcOffsetSeconds * 1000);
}

/** Current UTC offset (seconds) of an IANA zone; 0 if the zone is unknown. */
export function tzOffsetSeconds(timeZone: string, at: Date = new Date()): number {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part ?? '');
    if (!m) return 0;
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (Number(m[2]) * 3600 + Number(m[3] ?? 0) * 60);
  } catch {
    return 0;
  }
}

/** "6 PM", "noon", "midnight", "9 AM". */
export function hourLabel(local: string): string {
  const h = hourOf(local);
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}
