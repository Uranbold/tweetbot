import type { Location, ModelId } from '../../types.js';
import { MODELS } from '../../domain/models.js';
import { chunk, mapLimit } from '../../lib/concurrency.js';
import { reverseFromCatalog } from '../catalog.js';
import type {
  AirData, AirQualityProvider, AirReading, Coords, Forecast, GeocodingProvider, ModelComparisonData, ModelComparisonProvider,
  PointSnapshot, Sourced, WeatherProvider,
} from '../ports.js';
import { buildUrl, getJson, type FetchLike } from './http.js';
import {
  AIR_VARS, FORECAST_CURRENT, FORECAST_DAILY, FORECAST_HOURLY, MODEL_DAILY, MODEL_HOURLY, OPEN_METEO, SNAPSHOT_CURRENT,
  SNAPSHOT_DAILY, parseAirCurrentBatch, parseAirQuality, parseForecast, parseGeocoding, parseModels, parseSnapshots,
} from './parse.js';

export interface OpenMeteoOptions {
  timeoutMs: number;
  fetch?: FetchLike;
  now?: () => Date;
  forecastUrl?: string;
  airQualityUrl?: string;
  geocodingUrl?: string;
  /** Locations per batched request and how many batches may run at once. */
  batchSize?: number;
  batchConcurrency?: number;
}

const DEFAULTS = {
  forecastUrl: 'https://api.open-meteo.com/v1/forecast',
  airQualityUrl: 'https://air-quality-api.open-meteo.com/v1/air-quality',
  geocodingUrl: 'https://geocoding-api.open-meteo.com/v1/search',
};

const fixed = (n: number) => n.toFixed(4);
const list = (cs: readonly Coords[], k: 'lat' | 'lon') => cs.map((c) => fixed(c[k])).join(',');

abstract class OpenMeteoBase {
  readonly name = OPEN_METEO;
  protected readonly opts: Required<Omit<OpenMeteoOptions, 'fetch'>> & { fetch?: FetchLike };

  constructor(opts: OpenMeteoOptions) {
    this.opts = { now: () => new Date(), batchSize: 50, batchConcurrency: 2, ...DEFAULTS, ...opts };
  }

  protected get(url: string, upstream: string): Promise<unknown> {
    const o: Parameters<typeof getJson>[1] = { timeoutMs: this.opts.timeoutMs, upstream };
    if (this.opts.fetch) o.fetch = this.opts.fetch;
    return getJson(url, o);
  }

  protected sourced<T>(value: T): Sourced<T> {
    return { value, source: { provider: OPEN_METEO, mock: false, fetchedAt: this.opts.now().toISOString() } };
  }

  protected async batched<T>(cs: readonly Coords[], one: (group: Coords[]) => Promise<T[]>): Promise<T[]> {
    const groups = chunk(cs, this.opts.batchSize);
    return (await mapLimit(groups, this.opts.batchConcurrency, one)).flat();
  }
}

export class OpenMeteoWeatherProvider extends OpenMeteoBase implements WeatherProvider {
  forecastUrl(c: Coords): string {
    return buildUrl(this.opts.forecastUrl, {
      latitude: fixed(c.lat),
      longitude: fixed(c.lon),
      current: FORECAST_CURRENT.join(','),
      hourly: FORECAST_HOURLY.join(','),
      daily: FORECAST_DAILY.join(','),
      past_days: 1,
      forecast_days: 10,
      timezone: 'auto',
      wind_speed_unit: 'ms',
    });
  }

  async getForecast(c: Coords): Promise<Sourced<Forecast>> {
    return this.sourced(parseForecast(await this.get(this.forecastUrl(c), 'open-meteo forecast')));
  }

  async getSnapshots(cs: readonly Coords[]): Promise<Sourced<PointSnapshot[]>> {
    const value = await this.batched(cs, async (group) => {
      const url = buildUrl(this.opts.forecastUrl, {
        latitude: list(group, 'lat'),
        longitude: list(group, 'lon'),
        current: SNAPSHOT_CURRENT.join(','),
        daily: SNAPSHOT_DAILY.join(','),
        forecast_days: 1,
        timezone: 'auto',
        wind_speed_unit: 'ms',
      });
      return parseSnapshots(await this.get(url, 'open-meteo forecast'), group.length);
    });
    return this.sourced(value);
  }
}

export class OpenMeteoModelProvider extends OpenMeteoBase implements ModelComparisonProvider {
  async getModels(c: Coords, models: readonly ModelId[]): Promise<Sourced<ModelComparisonData>> {
    const url = buildUrl(this.opts.forecastUrl, {
      latitude: fixed(c.lat),
      longitude: fixed(c.lon),
      hourly: MODEL_HOURLY.join(','),
      daily: MODEL_DAILY.join(','),
      models: models.map((m) => MODELS[m].openMeteo).join(','),
      forecast_days: 7,
      timezone: 'auto',
      wind_speed_unit: 'ms',
    });
    return this.sourced(parseModels(await this.get(url, 'open-meteo forecast'), models));
  }
}

export class OpenMeteoAirProvider extends OpenMeteoBase implements AirQualityProvider {
  async getAirQuality(c: Coords): Promise<Sourced<AirData>> {
    const url = buildUrl(this.opts.airQualityUrl, {
      latitude: fixed(c.lat),
      longitude: fixed(c.lon),
      current: AIR_VARS.join(','),
      hourly: AIR_VARS.join(','),
      forecast_days: 4,
      timezone: 'auto',
    });
    return this.sourced(parseAirQuality(await this.get(url, 'open-meteo air-quality')));
  }

  async getCurrentBatch(cs: readonly Coords[]): Promise<Sourced<AirReading[]>> {
    const value = await this.batched(cs, async (group) => {
      const url = buildUrl(this.opts.airQualityUrl, {
        latitude: list(group, 'lat'),
        longitude: list(group, 'lon'),
        current: AIR_VARS.join(','),
        timezone: 'auto',
      });
      return parseAirCurrentBatch(await this.get(url, 'open-meteo air-quality'), group.length);
    });
    return this.sourced(value);
  }
}

export class OpenMeteoGeocodingProvider extends OpenMeteoBase implements GeocodingProvider {
  async search(query: string, limit: number): Promise<Sourced<Location[]>> {
    const url = buildUrl(this.opts.geocodingUrl, { name: query, count: limit, language: 'en', format: 'json' });
    return this.sourced(parseGeocoding(await this.get(url, 'open-meteo geocoding'), this.opts.now()).slice(0, limit));
  }

  /** Open-Meteo has no free reverse endpoint: resolve against the built-in catalogue. */
  async reverse(c: Coords): Promise<Sourced<Location>> {
    return this.sourced(reverseFromCatalog(c, this.opts.now()));
  }
}
