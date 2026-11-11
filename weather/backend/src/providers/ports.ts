/**
 * Provider ports (hexagonal "driven" side). Shapes are vendor-neutral: adapters
 * translate Open-Meteo (or mock) payloads into these, and services never see vendor JSON.
 */
import type { Location, ModelId } from '../types.js';

export interface Coords {
  lat: number;
  lon: number;
}

/** Where a value came from; becomes ApiMeta. */
export interface Source {
  provider: string; // "open-meteo" | "mock"
  mock: boolean;
  fetchedAt: string; // ISO UTC
}

export interface Sourced<T> {
  value: T;
  source: Source;
}

export interface PlaceInfo {
  latitude: number;
  longitude: number;
  timezone: string;
  utcOffsetSeconds: number;
  elevation?: number;
}

export interface ForecastCurrent {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  isDay: boolean;
  cloudCover: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  windGust: number;
}

export interface ForecastHour {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitationProbability: number;
  precipitation: number;
  snowfall: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  windGust: number;
  uvIndex: number;
  visibility: number; // km
  cloudCover: number;
  isDay: boolean;
}

export interface ForecastDay {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  feelsLikeMax: number;
  feelsLikeMin: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  precipitationSum: number;
  snowfallSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  windGustMax: number;
}

/** Forecast incl. the previous day (past_days=1) and 10 forecast days. */
export interface Forecast {
  place: PlaceInfo;
  current: ForecastCurrent;
  hourly: ForecastHour[];
  daily: ForecastDay[];
}

/** Lightweight per-city values for the nation snapshot (one batched upstream call). */
export interface PointSnapshot {
  place: PlaceInfo;
  time: string;
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbabilityMax: number;
}

export interface WeatherProvider {
  readonly name: string;
  getForecast(c: Coords): Promise<Sourced<Forecast>>;
  /** Same order as the input. */
  getSnapshots(cs: readonly Coords[]): Promise<Sourced<PointSnapshot[]>>;
}

export interface AirReading {
  time: string;
  pm10: number;
  pm25: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
  usAqi?: number;
}

export interface AirData {
  place: PlaceInfo;
  current: AirReading;
  /** From local midnight today, 4 days. */
  hourly: AirReading[];
}

export interface AirQualityProvider {
  readonly name: string;
  getAirQuality(c: Coords): Promise<Sourced<AirData>>;
  /** Current readings only, same order as the input. */
  getCurrentBatch(cs: readonly Coords[]): Promise<Sourced<AirReading[]>>;
}

export interface GeocodingProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<Sourced<Location[]>>;
  reverse(c: Coords): Promise<Sourced<Location>>;
}

export interface ModelHour {
  time: string;
  temperature: number;
  precipitationProbability: number | null;
  precipitation: number;
  weatherCode: number;
}

export interface ModelDay {
  date: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationSum: number;
  weatherCode: number | null;
}

export interface ModelRun {
  model: ModelId;
  hourly: ModelHour[];
  daily: ModelDay[];
}

export interface ModelComparisonData {
  place: PlaceInfo;
  /** Models with no data at this location (e.g. a regional model outside its domain) are omitted. */
  models: ModelRun[];
}

export interface ModelComparisonProvider {
  readonly name: string;
  getModels(c: Coords, models: readonly ModelId[]): Promise<Sourced<ModelComparisonData>>;
}

export interface Providers {
  weather: WeatherProvider;
  air: AirQualityProvider;
  geocoding: GeocodingProvider;
  models: ModelComparisonProvider;
}
