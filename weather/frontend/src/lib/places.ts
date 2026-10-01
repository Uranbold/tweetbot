import type { Location } from '@contract';

/** Minimal location shape persisted in the URL / localStorage. */
export interface Place {
  name: string;
  lat: number;
  lon: number;
  admin1?: string;
  country?: string;
  countryCode?: string;
}

export const DEFAULT_PLACE: Place = { name: 'Ulaanbaatar', lat: 47.92, lon: 106.92, country: 'Mongolia', countryCode: 'MN' };
export const DEFAULT_TIMEZONE = 'Asia/Ulaanbaatar';

export const PRESETS: Place[] = [
  DEFAULT_PLACE,
  { name: 'Seoul', lat: 37.57, lon: 126.98, country: 'South Korea', countryCode: 'KR' },
  { name: 'Tokyo', lat: 35.69, lon: 139.69, country: 'Japan', countryCode: 'JP' },
  { name: 'New York', lat: 40.71, lon: -74.01, admin1: 'New York', country: 'United States', countryCode: 'US' },
];

/** Identity used to de-duplicate favourites/recents (coordinates rounded to 2 dp). */
export function placeKey(p: { lat: number; lon: number }): string {
  return `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
}

export function samePlace(a: { lat: number; lon: number }, b: { lat: number; lon: number }): boolean {
  return placeKey(a) === placeKey(b);
}

export function toPlace(l: Location | Place): Place {
  const p: Place = { name: l.name, lat: round2(l.lat), lon: round2(l.lon) };
  if (l.admin1) p.admin1 = l.admin1;
  if (l.country) p.country = l.country;
  if (l.countryCode) p.countryCode = l.countryCode;
  return p;
}

export function placeSubtitle(p: { admin1?: string; country?: string }): string {
  return [p.admin1, p.country].filter((s, i, arr) => s && arr.indexOf(s) === i).join(', ');
}

/** Builds "?lat=..&lon=..&name=.." preserving any extra params given. */
export function placeSearch(p: Place, extra?: Record<string, string>): string {
  const sp = new URLSearchParams();
  sp.set('lat', p.lat.toFixed(2));
  sp.set('lon', p.lon.toFixed(2));
  sp.set('name', p.name);
  for (const [k, v] of Object.entries(extra ?? {})) sp.set(k, v);
  return `?${sp.toString()}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
