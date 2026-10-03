/**
 * Fallback decorators (auto mode): call the live adapter; on a transient upstream failure
 * (429 / 5xx / timeout / network / bad payload) answer from the mock adapter instead.
 * After a failure the live adapter is skipped for `cooldownMs` so a quota-exhausted
 * upstream does not add latency to every request.
 */
import type { Location, ModelId } from '../types.js';
import { isUpstreamError } from '../errors.js';
import type {
  AirData, AirQualityProvider, AirReading, Coords, Forecast, GeocodingProvider, ModelComparisonData, ModelComparisonProvider,
  PointSnapshot, Providers, Sourced, WeatherProvider,
} from './ports.js';

export interface FallbackEvent {
  port: string;
  error: unknown;
}

export interface FallbackStats {
  fallbacks: number;
  skippedWhileCoolingDown: number;
  lastError: string | null;
  lastErrorAt: string | null;
  coolingDownUntil: string | null;
}

export class FallbackPolicy {
  private openUntil = 0;
  private readonly stats: Omit<FallbackStats, 'coolingDownUntil'> = { fallbacks: 0, skippedWhileCoolingDown: 0, lastError: null, lastErrorAt: null };

  constructor(
    private readonly cooldownMs: number,
    private readonly onFallback?: (e: FallbackEvent) => void,
    private readonly clock: () => number = Date.now,
  ) {}

  /** Transient upstream failures trigger the fallback; programming errors and client errors do not. */
  static eligible(err: unknown): boolean {
    return isUpstreamError(err) && err.transient;
  }

  async run<T>(port: string, primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.clock() < this.openUntil) {
      this.stats.skippedWhileCoolingDown++;
      return fallback();
    }
    try {
      return await primary();
    } catch (err) {
      if (!FallbackPolicy.eligible(err)) throw err;
      this.stats.fallbacks++;
      this.stats.lastError = err instanceof Error ? err.message : String(err);
      this.stats.lastErrorAt = new Date(this.clock()).toISOString();
      if (this.cooldownMs > 0) this.openUntil = this.clock() + this.cooldownMs;
      this.onFallback?.({ port, error: err });
      return fallback();
    }
  }

  snapshot(): FallbackStats {
    const now = this.clock();
    return { ...this.stats, coolingDownUntil: now < this.openUntil ? new Date(this.openUntil).toISOString() : null };
  }
}

export class FallbackWeatherProvider implements WeatherProvider {
  readonly name: string;
  constructor(private readonly primary: WeatherProvider, private readonly secondary: WeatherProvider, private readonly policy: FallbackPolicy) {
    this.name = `${primary.name}→${secondary.name}`;
  }
  getForecast(c: Coords): Promise<Sourced<Forecast>> {
    return this.policy.run('weather', () => this.primary.getForecast(c), () => this.secondary.getForecast(c));
  }
  getSnapshots(cs: readonly Coords[]): Promise<Sourced<PointSnapshot[]>> {
    return this.policy.run('weather', () => this.primary.getSnapshots(cs), () => this.secondary.getSnapshots(cs));
  }
}

export class FallbackAirProvider implements AirQualityProvider {
  readonly name: string;
  constructor(private readonly primary: AirQualityProvider, private readonly secondary: AirQualityProvider, private readonly policy: FallbackPolicy) {
    this.name = `${primary.name}→${secondary.name}`;
  }
  getAirQuality(c: Coords): Promise<Sourced<AirData>> {
    return this.policy.run('air', () => this.primary.getAirQuality(c), () => this.secondary.getAirQuality(c));
  }
  getCurrentBatch(cs: readonly Coords[]): Promise<Sourced<AirReading[]>> {
    return this.policy.run('air', () => this.primary.getCurrentBatch(cs), () => this.secondary.getCurrentBatch(cs));
  }
}

export class FallbackGeocodingProvider implements GeocodingProvider {
  readonly name: string;
  constructor(private readonly primary: GeocodingProvider, private readonly secondary: GeocodingProvider, private readonly policy: FallbackPolicy) {
    this.name = `${primary.name}→${secondary.name}`;
  }
  search(q: string, limit: number): Promise<Sourced<Location[]>> {
    return this.policy.run('geocoding', () => this.primary.search(q, limit), () => this.secondary.search(q, limit));
  }
  reverse(c: Coords): Promise<Sourced<Location>> {
    return this.policy.run('geocoding', () => this.primary.reverse(c), () => this.secondary.reverse(c));
  }
}

export class FallbackModelProvider implements ModelComparisonProvider {
  readonly name: string;
  constructor(private readonly primary: ModelComparisonProvider, private readonly secondary: ModelComparisonProvider, private readonly policy: FallbackPolicy) {
    this.name = `${primary.name}→${secondary.name}`;
  }
  getModels(c: Coords, models: readonly ModelId[]): Promise<Sourced<ModelComparisonData>> {
    return this.policy.run('models', () => this.primary.getModels(c, models), () => this.secondary.getModels(c, models));
  }
}

/**
 * One policy per upstream host: forecast + model comparison share api.open-meteo.com, so a 429
 * there should not stop air-quality or geocoding (different hosts, separate quotas).
 */
export function withFallback(
  live: Providers,
  mock: Providers,
  policies: { forecast: FallbackPolicy; air: FallbackPolicy; geocoding: FallbackPolicy },
): Providers {
  return {
    weather: new FallbackWeatherProvider(live.weather, mock.weather, policies.forecast),
    models: new FallbackModelProvider(live.models, mock.models, policies.forecast),
    air: new FallbackAirProvider(live.air, mock.air, policies.air),
    geocoding: new FallbackGeocodingProvider(live.geocoding, mock.geocoding, policies.geocoding),
  };
}
