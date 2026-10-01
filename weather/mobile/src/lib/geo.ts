import type { Region } from '@contract';

/** Great-circle distance in km. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Region whose bbox contains the point, else the nearest representative point. */
export function nearestRegion(regions: Region[], lat: number, lon: number): Region | null {
  if (regions.length === 0) return null;
  const inBox = regions.find(
    (r) => r.bbox && lat >= r.bbox.minLat && lat <= r.bbox.maxLat && lon >= r.bbox.minLon && lon <= r.bbox.maxLon,
  );
  if (inBox) return inBox;
  let best: Region | null = null;
  let bestD = Infinity;
  for (const r of regions) {
    const d = haversineKm(lat, lon, r.lat, r.lon);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

export const DEFAULT_COORDS = { lat: 47.92, lon: 106.92, name: 'Ulaanbaatar' };
