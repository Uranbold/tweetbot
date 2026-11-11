import type { Location } from '../types.js';
import type { ReadThroughCache } from '../cache/readThrough.js';
import { coordKey } from '../lib/geo.js';
import { reverseFromCatalog } from '../providers/catalog.js';
import type { Coords, GeocodingProvider, PlaceInfo } from '../providers/ports.js';
import { cachedResponse, metaFrom, type CachePolicy, type ServiceResult } from './common.js';

export class LocationService {
  constructor(
    private readonly geocoder: GeocodingProvider,
    private readonly cache: ReadThroughCache,
    private readonly policy: CachePolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  search(query: string, limit: number): Promise<ServiceResult<Location[]>> {
    const q = query.trim();
    return cachedResponse(this.cache, `geo:search:${q.toLowerCase()}:${limit}`, this.policy, async () => {
      const r = await this.geocoder.search(q, limit);
      return { data: r.value, meta: metaFrom(r.source) };
    });
  }

  reverse(c: Coords): Promise<ServiceResult<Location>> {
    return cachedResponse(this.cache, `geo:reverse:${coordKey(c.lat, c.lon)}`, this.policy, async () => {
      const r = await this.geocoder.reverse(c);
      return { data: r.value, meta: metaFrom(r.source) };
    });
  }

  /**
   * Location for a forecast response: name from reverse geocoding, time zone / offset /
   * elevation from the upstream forecast (authoritative, DST-correct).
   */
  async resolve(c: Coords, place?: PlaceInfo): Promise<Location> {
    let loc: Location;
    try {
      loc = (await this.reverse(c)).body.data;
    } catch {
      loc = reverseFromCatalog(c, this.clock());
    }
    if (!place) return loc;
    const out: Location = { ...loc, timezone: place.timezone, utcOffsetSeconds: place.utcOffsetSeconds };
    if (out.elevation === undefined && place.elevation !== undefined) out.elevation = place.elevation;
    return out;
  }
}
