/**
 * Pure translation of Open-Meteo JSON into port shapes. Validated with zod so a
 * vendor schema change surfaces as UpstreamError('parse') instead of NaNs downstream.
 */
import { z } from 'zod';
import type { Location, ModelId } from '../../types.js';
import { UpstreamError } from '../../errors.js';
import { MODELS } from '../../domain/models.js';
import { tzOffsetSeconds } from '../../lib/time.js';
import type {
  AirData, AirReading, Forecast, ForecastCurrent, ForecastDay, ForecastHour, ModelComparisonData, ModelDay, ModelHour,
  ModelRun, PlaceInfo, PointSnapshot,
} from '../ports.js';

const cell = z.union([z.number(), z.string(), z.null()]);
const block = z.record(z.string(), z.array(cell));
const base = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  utc_offset_seconds: z.number(),
  elevation: z.number().nullish(),
  current: z.record(z.string(), cell).optional(),
  hourly: block.optional(),
  daily: block.optional(),
});
type Base = z.infer<typeof base>;
type Block = z.infer<typeof block>;

export const OPEN_METEO = 'open-meteo';

function fail(message: string): never {
  throw new UpstreamError(OPEN_METEO, 'parse', message);
}

function parseBase(json: unknown): Base {
  const r = base.safeParse(json);
  if (!r.success) fail(`unexpected payload: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
  return r.data;
}

/** Normalise a single-or-multi-location response into an array. */
function asList(json: unknown): unknown[] {
  return Array.isArray(json) ? json : [json];
}

function place(b: Base): PlaceInfo {
  const p: PlaceInfo = { latitude: b.latitude, longitude: b.longitude, timezone: b.timezone, utcOffsetSeconds: b.utc_offset_seconds };
  if (typeof b.elevation === 'number') p.elevation = b.elevation;
  return p;
}

function times(b: Block | undefined, name: string): string[] {
  const t = b?.time;
  if (!t || !t.every((x) => typeof x === 'string')) fail(`${name}.time missing`);
  return t as string[];
}

/** Numeric column with nulls forward/back-filled; `fallback` when the column is absent or all null. */
function numCol(b: Block, key: string, length: number, fallback?: number): number[] {
  const raw = b[key];
  const vals = raw?.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)) ?? [];
  const firstIdx = vals.findIndex((v) => v !== null);
  if (firstIdx < 0) {
    if (fallback === undefined) fail(`required column ${key} missing`);
    return new Array<number>(length).fill(fallback);
  }
  const out = new Array<number>(length);
  let last = vals[firstIdx] as number;
  for (let i = 0; i < length; i++) {
    const v = vals[i];
    if (typeof v === 'number') last = v;
    out[i] = last;
  }
  return out;
}

function strCol(b: Block, key: string, length: number): string[] {
  const raw = b[key] ?? [];
  return Array.from({ length }, (_, i) => (typeof raw[i] === 'string' ? (raw[i] as string) : ''));
}

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export const FORECAST_CURRENT = ['temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day', 'precipitation', 'weather_code', 'cloud_cover', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'];
export const FORECAST_HOURLY = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'precipitation_probability', 'precipitation', 'snowfall', 'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'uv_index', 'visibility', 'cloud_cover', 'is_day'];
export const FORECAST_DAILY = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'apparent_temperature_min', 'sunrise', 'sunset', 'uv_index_max', 'precipitation_sum', 'snowfall_sum', 'precipitation_probability_max', 'wind_speed_10m_max', 'wind_gusts_10m_max'];

export function parseForecast(json: unknown): Forecast {
  const b = parseBase(Array.isArray(json) ? json[0] : json);
  if (!b.hourly || !b.daily) fail('hourly/daily blocks missing');
  const ht = times(b.hourly, 'hourly');
  const n = ht.length;
  const h = b.hourly;
  const col = (k: string, fb?: number) => numCol(h, k, n, fb);
  const [temp, feels, rh, pop, prcp, snow, code, ws, wd, wg, uv, vis, cc, day] = [
    col('temperature_2m'), col('apparent_temperature'), col('relative_humidity_2m', 50), col('precipitation_probability', 0),
    col('precipitation', 0), col('snowfall', 0), col('weather_code', 3), col('wind_speed_10m', 0), col('wind_direction_10m', 0),
    col('wind_gusts_10m', 0), col('uv_index', 0), col('visibility', 24_140), col('cloud_cover', 50), col('is_day', 1),
  ];
  const hourly: ForecastHour[] = ht.map((time, i) => ({
    time,
    temperature: temp[i]!,
    feelsLike: feels[i]!,
    humidity: rh[i]!,
    precipitationProbability: pop[i]!,
    precipitation: prcp[i]!,
    snowfall: snow[i]!,
    weatherCode: code[i]!,
    windSpeed: ws[i]!,
    windDirection: wd[i]!,
    windGust: wg[i]!,
    uvIndex: uv[i]!,
    visibility: vis[i]! / 1000,
    cloudCover: cc[i]!,
    isDay: day[i]! === 1,
  }));

  const dt = times(b.daily, 'daily');
  const m = dt.length;
  const d = b.daily;
  const dcol = (k: string, fb?: number) => numCol(d, k, m, fb);
  const [dcode, tmax, tmin, fmax, fmin, uvmax, psum, ssum, popmax, wsmax, wgmax] = [
    dcol('weather_code', 3), dcol('temperature_2m_max'), dcol('temperature_2m_min'), dcol('apparent_temperature_max'),
    dcol('apparent_temperature_min'), dcol('uv_index_max', 0), dcol('precipitation_sum', 0), dcol('snowfall_sum', 0),
    dcol('precipitation_probability_max', 0), dcol('wind_speed_10m_max', 0), dcol('wind_gusts_10m_max', 0),
  ];
  const sunrise = strCol(d, 'sunrise', m);
  const sunset = strCol(d, 'sunset', m);
  const daily: ForecastDay[] = dt.map((date, i) => ({
    date,
    weatherCode: dcode[i]!,
    temperatureMax: tmax[i]!,
    temperatureMin: tmin[i]!,
    feelsLikeMax: fmax[i]!,
    feelsLikeMin: fmin[i]!,
    sunrise: sunrise[i]!,
    sunset: sunset[i]!,
    uvIndexMax: uvmax[i]!,
    precipitationSum: psum[i]!,
    snowfallSum: ssum[i]!,
    precipitationProbabilityMax: popmax[i]!,
    windSpeedMax: wsmax[i]!,
    windGustMax: wgmax[i]!,
  }));

  const c = b.current;
  if (!c || typeof c.time !== 'string') fail('current block missing');
  const nowHour = hourly.find((x) => x.time === `${(c.time as string).slice(0, 13)}:00`) ?? hourly[0]!;
  const current: ForecastCurrent = {
    time: c.time as string,
    temperature: num(c.temperature_2m) ?? nowHour.temperature,
    feelsLike: num(c.apparent_temperature) ?? nowHour.feelsLike,
    humidity: num(c.relative_humidity_2m) ?? nowHour.humidity,
    precipitation: num(c.precipitation) ?? nowHour.precipitation,
    weatherCode: num(c.weather_code) ?? nowHour.weatherCode,
    isDay: (num(c.is_day) ?? (nowHour.isDay ? 1 : 0)) === 1,
    cloudCover: num(c.cloud_cover) ?? nowHour.cloudCover,
    pressure: num(c.pressure_msl) ?? 1013,
    windSpeed: num(c.wind_speed_10m) ?? nowHour.windSpeed,
    windDirection: num(c.wind_direction_10m) ?? nowHour.windDirection,
    windGust: num(c.wind_gusts_10m) ?? nowHour.windGust,
  };
  return { place: place(b), current, hourly, daily };
}

export const SNAPSHOT_CURRENT = ['temperature_2m', 'weather_code', 'is_day'];
export const SNAPSHOT_DAILY = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_probability_max'];

export function parseSnapshots(json: unknown, expected: number): PointSnapshot[] {
  const list = asList(json);
  if (list.length !== expected) fail(`expected ${expected} locations, got ${list.length}`);
  return list.map((item) => {
    const b = parseBase(item);
    const c = b.current;
    if (!c || typeof c.time !== 'string' || !b.daily) fail('current/daily block missing');
    const d = b.daily;
    const n = times(d, 'daily').length;
    const temperature = num(c.temperature_2m);
    if (temperature === undefined) fail('current.temperature_2m missing');
    return {
      place: place(b),
      time: c.time as string,
      temperature,
      weatherCode: num(c.weather_code) ?? 3,
      isDay: num(c.is_day) === 1,
      temperatureMax: numCol(d, 'temperature_2m_max', n)[0]!,
      temperatureMin: numCol(d, 'temperature_2m_min', n)[0]!,
      precipitationProbabilityMax: numCol(d, 'precipitation_probability_max', n, 0)[0]!,
    };
  });
}

/** Open-Meteo air-quality variable → AirReading field. */
const AIR_FIELDS = [
  ['pm10', 'pm10'],
  ['pm2_5', 'pm25'],
  ['ozone', 'o3'],
  ['nitrogen_dioxide', 'no2'],
  ['sulphur_dioxide', 'so2'],
  ['carbon_monoxide', 'co'],
] as const;
export const AIR_VARS = [...AIR_FIELDS.map(([k]) => k), 'us_aqi'];

/** Build a reading; missing values come from `fallback` (or 0). */
function readingFrom(get: (k: string) => number | undefined, time: string, fallback?: AirReading): AirReading {
  const r = { time } as AirReading;
  for (const [k, field] of AIR_FIELDS) r[field] = get(k) ?? fallback?.[field] ?? 0;
  const aqi = get('us_aqi') ?? fallback?.usAqi;
  if (aqi !== undefined) r.usAqi = aqi;
  return r;
}

export function parseAirQuality(json: unknown): AirData {
  const b = parseBase(Array.isArray(json) ? json[0] : json);
  if (!b.hourly) fail('hourly block missing');
  const ht = times(b.hourly, 'hourly');
  if (!ht.length) fail('no air-quality data');
  const h = b.hourly;
  const cols = Object.fromEntries(AIR_VARS.map((k) => [k, numCol(h, k, ht.length, k === 'us_aqi' ? Number.NaN : 0)]));
  const hourly = ht.map((time, i) =>
    readingFrom((k) => {
      const v = cols[k]![i]!;
      return Number.isNaN(v) ? undefined : v;
    }, time),
  );
  const c = b.current;
  const ctime = typeof c?.time === 'string' ? c.time : undefined;
  const sameHour = (ctime && hourly.find((x) => x.time === `${ctime.slice(0, 13)}:00`)) || hourly[0]!;
  const current = c && ctime ? readingFrom((k) => num(c[k]), ctime, sameHour) : sameHour;
  return { place: place(b), current, hourly };
}

export function parseAirCurrentBatch(json: unknown, expected: number): AirReading[] {
  const list = asList(json);
  if (list.length !== expected) fail(`expected ${expected} locations, got ${list.length}`);
  return list.map((item) => {
    const b = parseBase(item);
    const c = b.current;
    if (!c || typeof c.time !== 'string') fail('current block missing');
    return readingFrom((k) => num(c[k]), c.time);
  });
}

const geoResult = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().nullish(),
  timezone: z.string().nullish(),
  country: z.string().nullish(),
  country_code: z.string().nullish(),
  admin1: z.string().nullish(),
});
const geoResponse = z.object({ results: z.array(z.unknown()).optional() });

export function parseGeocoding(json: unknown, now: Date = new Date()): Location[] {
  const r = geoResponse.safeParse(json);
  if (!r.success) fail('unexpected geocoding payload');
  const out: Location[] = [];
  for (const raw of r.data.results ?? []) {
    const g = geoResult.safeParse(raw);
    if (!g.success) continue; // skip malformed entries rather than failing the whole search
    const x = g.data;
    const timezone = x.timezone ?? 'UTC';
    const loc: Location = {
      id: String(x.id),
      name: x.name,
      country: x.country ?? '',
      countryCode: (x.country_code ?? '').toUpperCase(),
      lat: x.latitude,
      lon: x.longitude,
      timezone,
      utcOffsetSeconds: tzOffsetSeconds(timezone, now),
    };
    if (x.admin1) loc.admin1 = x.admin1;
    if (typeof x.elevation === 'number') loc.elevation = x.elevation;
    out.push(loc);
  }
  return out;
}

export const MODEL_HOURLY = ['temperature_2m', 'precipitation_probability', 'precipitation', 'weather_code'];
export const MODEL_DAILY = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'weather_code'];

/** Multi-model response: every variable key is suffixed with the Open-Meteo model id (unless only one model was requested). */
export function parseModels(json: unknown, models: readonly ModelId[]): ModelComparisonData {
  const b = parseBase(Array.isArray(json) ? json[0] : json);
  if (!b.hourly || !b.daily) fail('hourly/daily blocks missing');
  const ht = times(b.hourly, 'hourly');
  const dt = times(b.daily, 'daily');
  const runs: ModelRun[] = [];
  for (const id of models) {
    const suffix = MODELS[id].openMeteo;
    const key = (blk: Block, v: string) => (`${v}_${suffix}` in blk || models.length > 1 ? `${v}_${suffix}` : v);
    const raw = (blk: Block, v: string) => blk[key(blk, v)] ?? [];
    const val = (arr: (string | number | null)[], i: number) => (typeof arr[i] === 'number' ? (arr[i] as number) : null);

    const hT = raw(b.hourly, 'temperature_2m');
    const hP = raw(b.hourly, 'precipitation_probability');
    const hR = raw(b.hourly, 'precipitation');
    const hC = raw(b.hourly, 'weather_code');
    const hasPop = hP.some((v) => typeof v === 'number');
    const hourly: ModelHour[] = [];
    ht.forEach((time, i) => {
      const t = val(hT, i);
      if (t === null) return;
      const precipitation = val(hR, i) ?? 0;
      hourly.push({
        time,
        temperature: t,
        precipitationProbability: hasPop ? val(hP, i) : null,
        precipitation,
        weatherCode: val(hC, i) ?? (precipitation >= 0.1 ? 61 : 3),
      });
    });

    const dMax = raw(b.daily, 'temperature_2m_max');
    const dMin = raw(b.daily, 'temperature_2m_min');
    const dSum = raw(b.daily, 'precipitation_sum');
    const dCode = raw(b.daily, 'weather_code');
    const daily: ModelDay[] = [];
    dt.forEach((date, i) => {
      const max = val(dMax, i);
      const min = val(dMin, i);
      if (max === null || min === null) return;
      daily.push({ date, temperatureMax: max, temperatureMin: min, precipitationSum: val(dSum, i) ?? 0, weatherCode: val(dCode, i) });
    });
    if (hourly.length || daily.length) runs.push({ model: id, hourly, daily });
  }
  return { place: place(b), models: runs };
}
