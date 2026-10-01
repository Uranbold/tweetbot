/**
 * Skycast API contract (v1) — single source of truth shared by backend and frontend.
 * Type-only module: import with `import type { ... } from '.../shared/contract'`.
 *
 * Conventions
 *  - All times are ISO-8601 local wall-clock strings for the location ("2026-10-01T14:00"),
 *    plus `location.timezone` (IANA) and `location.utcOffsetSeconds`.
 *  - Units: temperature °C, wind m/s, precipitation mm, snowfall cm, pressure hPa,
 *    visibility km, air pollutants µg/m³.
 *  - Every response is wrapped in `ApiResponse<T>`; errors use `ApiError`.
 */

// ---------- Envelope ----------

export interface ApiMeta {
  /** Provider that produced the data, e.g. "open-meteo" or "mock". */
  provider: string;
  /** ISO-8601 UTC timestamp when the upstream data was fetched. */
  fetchedAt: string;
  /** true when served from cache after the upstream failed (stale-while-error). */
  stale: boolean;
  /** true when served by the deterministic mock provider (upstream unavailable / MOCK mode). */
  mock: boolean;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiError {
  error: {
    code: 'BAD_REQUEST' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE' | 'RATE_LIMITED' | 'INTERNAL';
    message: string;
  };
}

// ---------- Shared value types ----------

/** Simplified condition set derived from WMO weather codes. */
export type ConditionKey =
  | 'clear'
  | 'mostly-clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'freezing-rain'
  | 'snow'
  | 'heavy-snow'
  | 'sleet'
  | 'thunderstorm';

export interface Condition {
  /** Raw WMO code (0–99). */
  code: number;
  key: ConditionKey;
  /** Human label in English, e.g. "Partly cloudy". */
  label: string;
  isDay: boolean;
}

export interface Location {
  /** Stable id: geocoder id, or "lat,lon" rounded to 2 decimals for ad-hoc coords. */
  id: string;
  name: string;
  /** State / province / city district. */
  admin1?: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone: string;
  utcOffsetSeconds: number;
  elevation?: number;
}

/** Korean (MoE/AirKorea) 4-tier grade, the one Naver displays. */
export type AirGrade = 'good' | 'moderate' | 'bad' | 'very-bad';

// ---------- /weather (aggregate "Today" BFF) ----------

export interface CurrentWeather {
  time: string;
  temperature: number;
  feelsLike: number;
  condition: Condition;
  humidity: number; // %
  windSpeed: number; // m/s
  windGust: number; // m/s
  windDirection: number; // degrees, meteorological (from)
  windDirectionLabel: string; // "NW"
  precipitation: number; // mm last hour
  pressure: number; // hPa
  cloudCover: number; // %
  visibility: number; // km
  uvIndex: number;
}

export interface YesterdayComparison {
  /** current temp minus temp at the same hour yesterday, 1 decimal. */
  temperatureDiff: number;
  /** e.g. "2.3° warmer than yesterday", "Same as yesterday". */
  message: string;
}

export interface HourlyPoint {
  time: string;
  temperature: number;
  feelsLike: number;
  condition: Condition;
  precipitationProbability: number; // %
  precipitation: number; // mm
  snowfall: number; // cm
  humidity: number; // %
  windSpeed: number; // m/s
  windDirection: number;
  uvIndex: number;
}

export interface HalfDay {
  condition: Condition;
  precipitationProbability: number;
}

export interface DailyPoint {
  date: string; // "2026-10-01"
  temperatureMin: number;
  temperatureMax: number;
  /** 00–12 local (Naver "오전"). */
  am: HalfDay;
  /** 12–24 local (Naver "오후"). */
  pm: HalfDay;
  precipitationSum: number;
  snowfallSum: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  windSpeedMax: number;
}

export interface AirQualitySnapshot {
  time: string;
  pm10: number;
  pm25: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
  pm10Grade: AirGrade;
  pm25Grade: AirGrade;
  /** The worse of the two grades. */
  overallGrade: AirGrade;
  usAqi?: number;
}

export type LifeIndexKey =
  | 'uv'
  | 'laundry'
  | 'car-wash'
  | 'clothing'
  | 'outdoor-activity'
  | 'food-poisoning'
  | 'heat-index'
  | 'wind-chill';

export type IndexLevel = 'very-low' | 'low' | 'moderate' | 'high' | 'very-high';

export interface LifeIndex {
  key: LifeIndexKey;
  label: string; // "UV index"
  level: IndexLevel;
  value?: number;
  /** One-line advice, e.g. "Great day for laundry". */
  advice: string;
}

export type AlertType =
  | 'heat-wave'
  | 'cold-wave'
  | 'heavy-rain'
  | 'heavy-snow'
  | 'strong-wind'
  | 'dry'
  | 'fine-dust'
  | 'typhoon';

export type AlertSeverity = 'advisory' | 'warning'; // Naver: 주의보 / 경보

export interface WeatherAlert {
  type: AlertType;
  severity: AlertSeverity;
  title: string; // "Heat wave advisory"
  description: string; // threshold rationale
  start: string;
  end?: string;
  /** "derived" = computed from forecast thresholds; "official" = upstream bulletin. */
  source: 'derived' | 'official';
}

export interface ClothingAdvice {
  /** e.g. "Light jacket, long sleeves" */
  summary: string;
  items: string[];
}

export interface TodayWeather {
  location: Location;
  current: CurrentWeather;
  comparison: YesterdayComparison;
  today: {
    temperatureMin: number;
    temperatureMax: number;
    sunrise: string;
    sunset: string;
    /** Natural-language headline, e.g. "Clear skies, rain likely after 6 PM". */
    headline: string;
  };
  /** Next 48 hours starting at the current hour. */
  hourly: HourlyPoint[];
  /** Today + 9 days (10 entries). */
  daily: DailyPoint[];
  air: AirQualitySnapshot | null;
  lifeIndices: LifeIndex[];
  alerts: WeatherAlert[];
  clothing: ClothingAdvice;
}

// ---------- /air ----------

export interface AirHourlyPoint {
  time: string;
  pm10: number;
  pm25: number;
  o3: number;
  pm10Grade: AirGrade;
  pm25Grade: AirGrade;
}

export interface AirQualityReport {
  location: Location;
  current: AirQualitySnapshot;
  /** Next 72 hours. */
  hourly: AirHourlyPoint[];
  /** Daily worst grade, next 4 days (Naver "미세먼지 예보"). */
  daily: { date: string; pm10Grade: AirGrade; pm25Grade: AirGrade; pm10Max: number; pm25Max: number }[];
  /** Grade thresholds used, so the UI can draw legends. */
  scale: {
    pm10: { grade: AirGrade; min: number; max: number | null }[];
    pm25: { grade: AirGrade; min: number; max: number | null }[];
  };
}

// ---------- /compare (Naver "예보비교") ----------

export type ModelId = 'ecmwf' | 'gfs' | 'icon' | 'jma' | 'kma' | 'gem' | 'meteofrance';

export interface ModelForecast {
  model: ModelId;
  /** "ECMWF IFS", "NOAA GFS", ... */
  label: string;
  /** Agency / country, e.g. "European Centre (EU)". */
  agency: string;
  hourly: { time: string; temperature: number; precipitationProbability: number | null; precipitation: number; condition: Condition }[];
  daily: { date: string; temperatureMin: number; temperatureMax: number; precipitationSum: number; condition: Condition }[];
}

export interface ForecastComparison {
  location: Location;
  models: ModelForecast[];
  /** Per-day spread across models, for an "agreement" indicator. */
  consensus: { date: string; temperatureMaxMean: number; temperatureMaxSpread: number; precipitationSumMean: number; agreement: 'high' | 'medium' | 'low' }[];
}

// ---------- /nation (nationwide map snapshot, Naver "전국날씨") ----------

export interface CitySnapshot {
  location: Location;
  temperature: number;
  condition: Condition;
  precipitationProbability: number;
  temperatureMin: number;
  temperatureMax: number;
  pm10Grade?: AirGrade;
}

export interface NationSnapshot {
  region: string; // "mn" | "kr" | "world"
  regionLabel: string;
  cities: CitySnapshot[];
}

// ---------- Endpoint map ----------

/**
 * GET /api/v1/health                              -> { status: 'ok', uptimeSeconds, provider, cache: { size, hits, misses } }
 * GET /api/v1/locations/search?q=<text>&limit=8   -> ApiResponse<Location[]>
 * GET /api/v1/locations/reverse?lat=&lon=         -> ApiResponse<Location>
 * GET /api/v1/weather?lat=&lon=                   -> ApiResponse<TodayWeather>
 * GET /api/v1/air?lat=&lon=                       -> ApiResponse<AirQualityReport>
 * GET /api/v1/compare?lat=&lon=&models=ecmwf,gfs  -> ApiResponse<ForecastComparison>
 * GET /api/v1/nation?region=mn|kr|world           -> ApiResponse<NationSnapshot>
 * GET /api/v1/regions                             -> ApiResponse<{ id: string; label: string }[]>
 *
 * Validation: lat ∈ [-90, 90], lon ∈ [-180, 180], q length 1..100 → else 400 BAD_REQUEST.
 * Caching headers: `Cache-Control: public, max-age=<ttl>` and `X-Cache: HIT|MISS|STALE`.
 */
export type Endpoints = never;
