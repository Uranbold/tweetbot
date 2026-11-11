import type { AirQualityReport, ForecastComparison, ModelId, NationSnapshot, TodayWeather, CitySnapshot } from '../types.js';
import type { ReadThroughCache } from '../cache/readThrough.js';
import { CITY_BY_ID, NATION_GROUPS, type CityGroup } from '../data/cities.js';
import { pm10Grade } from '../domain/air.js';
import { conditionFromWmo } from '../domain/wmo.js';
import { coordKey } from '../lib/geo.js';
import { cityToLocation } from '../providers/catalog.js';
import type { AirQualityProvider, Coords, ModelComparisonProvider, WeatherProvider } from '../providers/ports.js';
import { assembleAirReport, assembleComparison, assembleToday } from './assemble.js';
import { cachedResponse, metaFrom, type CachePolicy, type ServiceResult } from './common.js';
import type { LocationService } from './locationService.js';

export interface Logger {
  warn(obj: object, msg?: string): void;
}

const silent: Logger = { warn: () => {} };

/** Assembles the Home BFF payload: forecast and air quality in parallel; air failure → air: null. */
export class WeatherService {
  constructor(
    private readonly weather: WeatherProvider,
    private readonly air: AirQualityProvider,
    private readonly locations: LocationService,
    private readonly cache: ReadThroughCache,
    private readonly policy: CachePolicy,
    private readonly log: Logger = silent,
  ) {}

  getToday(c: Coords): Promise<ServiceResult<TodayWeather>> {
    return cachedResponse(this.cache, `weather:${coordKey(c.lat, c.lon)}`, this.policy, async () => {
      const [forecast, air] = await Promise.all([
        this.weather.getForecast(c),
        this.air.getAirQuality(c).catch((err: unknown) => {
          this.log.warn({ err: (err as Error).message }, 'air quality unavailable for /weather; continuing with air=null');
          return null;
        }),
      ]);
      const location = await this.locations.resolve(c, forecast.value.place);
      return {
        data: assembleToday(forecast.value, air?.value ?? null, location),
        meta: metaFrom(forecast.source, air?.source),
      };
    });
  }
}

export class AirService {
  constructor(
    private readonly air: AirQualityProvider,
    private readonly locations: LocationService,
    private readonly cache: ReadThroughCache,
    private readonly policy: CachePolicy,
  ) {}

  getReport(c: Coords): Promise<ServiceResult<AirQualityReport>> {
    return cachedResponse(this.cache, `air:${coordKey(c.lat, c.lon)}`, this.policy, async () => {
      const r = await this.air.getAirQuality(c);
      const location = await this.locations.resolve(c, r.value.place);
      return { data: assembleAirReport(r.value, location), meta: metaFrom(r.source) };
    });
  }
}

export class CompareService {
  constructor(
    private readonly models: ModelComparisonProvider,
    private readonly locations: LocationService,
    private readonly cache: ReadThroughCache,
    private readonly policy: CachePolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  getComparison(c: Coords, models: readonly ModelId[]): Promise<ServiceResult<ForecastComparison>> {
    const ids = [...new Set(models)];
    const key = `compare:${coordKey(c.lat, c.lon)}:${[...ids].sort().join(',')}`;
    return cachedResponse(this.cache, key, this.policy, async () => {
      const r = await this.models.getModels(c, ids);
      const location = await this.locations.resolve(c, r.value.place);
      return { data: assembleComparison(r.value, location, this.clock()), meta: metaFrom(r.source) };
    });
  }
}

/** Nationwide snapshot: one batched forecast call (+ one batched air call) for all cities. */
export class NationService {
  constructor(
    private readonly weather: WeatherProvider,
    private readonly air: AirQualityProvider,
    private readonly cache: ReadThroughCache,
    private readonly policy: CachePolicy,
    private readonly clock: () => Date = () => new Date(),
    private readonly log: Logger = silent,
  ) {}

  getSnapshot(group: CityGroup): Promise<ServiceResult<NationSnapshot>> {
    return cachedResponse(this.cache, `nation:${group}`, this.policy, async () => {
      const def = NATION_GROUPS[group];
      const cities = def.cityIds.map((id) => CITY_BY_ID.get(id)!);
      const coords = cities.map((c) => ({ lat: c.lat, lon: c.lon }));
      const [wx, air] = await Promise.all([
        this.weather.getSnapshots(coords),
        this.air.getCurrentBatch(coords).catch((err: unknown) => {
          this.log.warn({ err: (err as Error).message }, 'air quality unavailable for /nation; omitting pm10Grade');
          return null;
        }),
      ]);
      const now = this.clock();
      const snapshots: CitySnapshot[] = cities.map((city, i) => {
        const s = wx.value[i]!;
        const location = { ...cityToLocation(city, now), timezone: s.place.timezone, utcOffsetSeconds: s.place.utcOffsetSeconds };
        const snap: CitySnapshot = {
          location,
          temperature: s.temperature,
          condition: conditionFromWmo(s.weatherCode, s.isDay),
          precipitationProbability: Math.round(s.precipitationProbabilityMax),
          temperatureMin: s.temperatureMin,
          temperatureMax: s.temperatureMax,
        };
        const reading = air?.value[i];
        if (reading) snap.pm10Grade = pm10Grade(reading.pm10);
        return snap;
      });
      return { data: { region: group, regionLabel: def.label, cities: snapshots }, meta: metaFrom(wx.source, air?.source) };
    });
  }
}
