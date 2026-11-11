import type { Location } from '../types.js';
import { CITIES, type City } from '../data/cities.js';
import { coordKey, coordLabel, haversineKm, round2 } from '../lib/geo.js';
import { tzOffsetSeconds } from '../lib/time.js';
import type { Coords } from './ports.js';

/** A coordinate within this distance of a catalogue city resolves to that city. */
export const REVERSE_RADIUS_KM = 30;

export function cityToLocation(c: City, now: Date = new Date()): Location {
  const loc: Location = {
    id: c.id,
    name: c.name,
    country: c.country,
    countryCode: c.countryCode,
    lat: c.lat,
    lon: c.lon,
    timezone: c.timezone,
    utcOffsetSeconds: tzOffsetSeconds(c.timezone, now),
  };
  if (c.admin1) loc.admin1 = c.admin1;
  if (c.elevation !== undefined) loc.elevation = c.elevation;
  return loc;
}

export function nearestCity(c: Coords): { city: City; distanceKm: number } {
  let best = CITIES[0]!;
  let bestD = Infinity;
  for (const city of CITIES) {
    const d = haversineKm(c, city);
    if (d < bestD) [best, bestD] = [city, d];
  }
  return { city: best, distanceKm: bestD };
}

/**
 * Timezone guess for arbitrary coordinates without an upstream: the nearest catalogue
 * city's zone when reasonably close, else a whole-hour Etc/GMT zone from the longitude.
 */
export function guessTimezone(c: Coords): string {
  const { city, distanceKm } = nearestCity(c);
  if (distanceKm <= 600) return city.timezone;
  const h = Math.round(c.lon / 15);
  return h === 0 ? 'Etc/UTC' : `Etc/GMT${h > 0 ? '-' : '+'}${Math.abs(h)}`; // Etc/GMT signs are inverted
}

/** Reverse geocoding by nearest catalogue city; ad-hoc "lat,lon" Location otherwise. */
export function reverseFromCatalog(c: Coords, now: Date = new Date()): Location {
  const { city, distanceKm } = nearestCity(c);
  if (distanceKm <= REVERSE_RADIUS_KM) return cityToLocation(city, now);
  const timezone = guessTimezone(c);
  return {
    id: coordKey(c.lat, c.lon),
    name: coordLabel(c.lat, c.lon),
    country: '',
    countryCode: '',
    lat: round2(c.lat),
    lon: round2(c.lon),
    timezone,
    utcOffsetSeconds: tzOffsetSeconds(timezone, now),
  };
}
