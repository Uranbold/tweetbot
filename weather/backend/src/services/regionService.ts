import type { Region } from '../types.js';
import { CITIES, regionSlug, type City } from '../data/cities.js';
import { haversineKm } from '../lib/geo.js';

/** Half-size of the geofencing box around a city's representative point (km). */
const BBOX_HALF_KM = 25;

function toRegion(city: City): Region {
  const dLat = BBOX_HALF_KM / 111.32;
  const dLon = BBOX_HALF_KM / (111.32 * Math.max(0.1, Math.cos((city.lat * Math.PI) / 180)));
  const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
  return {
    id: regionSlug(city),
    name: city.name,
    country: city.countryCode,
    lat: city.lat,
    lon: city.lon,
    bbox: { minLat: r4(city.lat - dLat), minLon: r4(city.lon - dLon), maxLat: r4(city.lat + dLat), maxLon: r4(city.lon + dLon) },
  };
}

/** Notification regions: one per catalogue city (mn / kr / world). */
export class RegionService {
  private readonly regions: Region[];
  private readonly byId: Map<string, Region>;

  constructor(cities: readonly City[] = CITIES) {
    this.regions = cities.map(toRegion);
    this.byId = new Map(this.regions.map((r) => [r.id, r]));
    if (this.byId.size !== this.regions.length) throw new Error('Duplicate region ids in city catalogue');
  }

  list(): Region[] {
    return this.regions;
  }

  get(id: string): Region | undefined {
    return this.byId.get(id);
  }

  exists(id: string): boolean {
    return this.byId.has(id);
  }

  nearest(p: { lat: number; lon: number }): Region {
    let best = this.regions[0]!;
    let bestD = Infinity;
    for (const r of this.regions) {
      const d = haversineKm(p, r);
      if (d < bestD) [best, bestD] = [r, d];
    }
    return best;
  }
}
