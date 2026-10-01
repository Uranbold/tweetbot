/**
 * Synthetic but physically plausible weather: latitude/season baseline, elevation lapse rate,
 * diurnal cycle tied to local solar time, smooth synoptic noise, and condition codes derived
 * from the same cloud/precipitation fields (so codes, POP and mm always agree).
 */
import { CITIES } from '../../data/cities.js';
import { apparentTemperature } from '../../domain/feelsLike.js';
import { MODELS } from '../../domain/models.js';
import { isDaylight, solarElevation, sunTimes } from '../../domain/sun.js';
import { mostSevereCode } from '../../domain/wmo.js';
import { coordKey, haversineKm, round1 } from '../../lib/geo.js';
import { dateOf, instantOf, localTimeAt, tzOffsetSeconds } from '../../lib/time.js';
import type { ModelId } from '../../types.js';
import { guessTimezone } from '../catalog.js';
import type { AirReading, Coords, ForecastDay, ForecastHour, PlaceInfo } from '../ports.js';
import { smooth, unit } from './noise.js';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, step = 0.1) => Math.round(v / step) * step;
const DAY_MS = 86_400_000;

export function mockPlace(c: Coords, now: Date): PlaceInfo {
  const timezone = guessTimezone(c);
  let elevation = 0;
  for (const city of CITIES) if (haversineKm(c, city) <= 50 && city.elevation !== undefined) elevation = city.elevation;
  return { latitude: c.lat, longitude: c.lon, timezone, utcOffsetSeconds: tzOffsetSeconds(timezone, now), elevation };
}

function dayOfYear(local: string): number {
  const d = new Date(`${local.slice(0, 10)}T00:00:00Z`);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY_MS) + 1;
}

const inBox = (c: Coords, lat0: number, lat1: number, lon0: number, lon1: number) => c.lat >= lat0 && c.lat <= lat1 && c.lon >= lon0 && c.lon <= lon1;

/** Regional moisture bias: East-Asian monsoon (wet summer), Gobi/Sahara/Arabia (arid). */
function moistureBias(c: Coords, doy: number): number {
  const summer = Math.cos((2 * Math.PI * (doy - 200)) / 365.25);
  if (inBox(c, 40, 53, 85, 122)) return -0.22 + 0.12 * summer; // Mongolia: dry, summer rains
  if (inBox(c, 20, 45, 100, 150)) return 0.05 + 0.25 * summer; // East-Asian monsoon
  if (inBox(c, 15, 33, -15, 60)) return -0.45; // Sahara / Arabia
  return 0;
}

const aridity = (c: Coords) => (inBox(c, 40, 53, 85, 122) || inBox(c, 15, 33, -15, 60) ? 1 : 0);

/** Weather for one hour at a UTC instant. Pure function of (coords rounded to 2 dp, instant). */
export function hourAt(c: Coords, place: PlaceInfo, instant: Date): ForecastHour {
  const key = coordKey(c.lat, c.lon);
  const local = localTimeAt(instant, place.utcOffsetSeconds);
  const t = instant.getTime() / DAY_MS;
  const doy = dayOfYear(local);
  const hemi = c.lat >= 0 ? 1 : -1;
  const absLat = Math.abs(c.lat);

  const annualMean = 28 - 0.42 * absLat - 6.5 * ((place.elevation ?? 0) / 1000);
  const amplitude = Math.min(22, 0.38 * absLat) * (aridity(c) ? 1.15 : 1);
  const seasonal = annualMean + hemi * amplitude * Math.cos((2 * Math.PI * (doy - 200)) / 365.25);
  const synoptic = smooth(`${key}:syn`, t, [[4.3, 2.5], [7.9, 2.0], [13.1, 1.5]]);

  const w = clamp(smooth(`${key}:wet`, t, [[3.1, 0.45], [5.7, 0.35], [1.3, 0.2]]) + moistureBias(c, doy), -1.2, 1.2);
  const fast = smooth(`${key}:fast`, t, [[0.21, 0.5], [0.37, 0.5]]);
  const jitter = unit(`${key}:${instant.getTime()}`);

  const cloudCover = Math.round(clamp(50 + 65 * w + 12 * fast, 0, 100));
  const solarHour = (instant.getUTCHours() + instant.getUTCMinutes() / 60 + c.lon / 15 + 24) % 24;
  const diurnal = Math.cos((2 * Math.PI * (solarHour - 15)) / 24); // max ≈ 15:00, min ≈ 03:00 solar
  const dtr = 11 - 6 * (cloudCover / 100) + 3 * aridity(c);
  const temperature = round1(seasonal + synoptic + (dtr / 2) * diurnal + 0.3 * jitter);

  let rate = Math.max(0, (w - 0.35 + 0.15 * fast) * 5);
  if (rate < 0.1) rate = 0;
  if (temperature > 24 && rate > 0) rate *= 1.8; // convective summer showers
  const precipitation = round(rate, 0.1);

  let pop = Math.round(clamp(((w + 0.25) / 0.6) * 70 + 8 * fast, 0, 100));
  if (precipitation >= 0.1) pop = Math.max(pop, 60);
  pop = Math.round(pop / 5) * 5;

  const humidity = Math.round(clamp(58 + 30 * w - 14 * diurnal - 18 * aridity(c) + (precipitation > 0 ? 25 : 0), 12, 100));
  const windBase = 2.4 + 2.2 * Math.abs(smooth(`${key}:wind`, t, [[2.3, 1], [0.7, 0.5]])) + 1.2 * Math.max(diurnal, 0) + (w > 0.3 ? 1.5 : 0);
  const windSpeed = round(windBase, 0.1);
  const windGust = round(windSpeed * 1.6 + 1.5, 0.1);
  const windDirection = Math.round((((270 + 100 * smooth(`${key}:dir`, t, [[5.3, 1]])) % 360) + 360) % 360);

  const snowy = temperature <= 0.5;
  let weatherCode: number;
  if (precipitation >= 0.1) {
    if (snowy) weatherCode = precipitation < 1 ? 71 : precipitation < 2.5 ? 73 : 75;
    else if (temperature <= 2) weatherCode = 68;
    else if (temperature >= 22 && precipitation >= 2) weatherCode = 95;
    else weatherCode = precipitation < 0.3 ? 51 : precipitation < 2 ? 61 : precipitation < 4 ? 63 : 65;
  } else if (humidity >= 96 && windSpeed < 3 && solarHour >= 3 && solarHour <= 9) {
    weatherCode = 45;
  } else {
    weatherCode = cloudCover < 15 ? 0 : cloudCover < 40 ? 1 : cloudCover < 75 ? 2 : 3;
  }

  const elev = solarElevation(c.lat, c.lon, instant);
  const uvIndex = elev > 0 ? round(12 * Math.pow(Math.sin((elev * Math.PI) / 180), 2.5) * (1 - 0.65 * (cloudCover / 100)), 0.05) : 0;
  const visibility = weatherCode === 45 ? 0.4 : precipitation > 0 ? round(Math.max(2, 10 - precipitation * 1.5), 0.1) : humidity > 90 ? 12 : 24.1;

  return {
    time: local,
    temperature,
    feelsLike: round1(apparentTemperature(temperature, humidity, windSpeed)),
    humidity,
    precipitationProbability: pop,
    precipitation,
    snowfall: snowy ? round(precipitation * 0.7, 0.01) : 0,
    weatherCode,
    windSpeed,
    windDirection,
    windGust,
    uvIndex,
    visibility,
    cloudCover,
    isDay: isDaylight(c.lat, c.lon, instant),
  };
}

/** Hourly series from local midnight of `startDate` for `days` days. */
export function hoursFrom(c: Coords, place: PlaceInfo, startDate: string, days: number): ForecastHour[] {
  const start = instantOf(`${startDate}T00:00`, place.utcOffsetSeconds).getTime();
  return Array.from({ length: days * 24 }, (_, i) => hourAt(c, place, new Date(start + i * 3_600_000)));
}

export function aggregateDays(c: Coords, place: PlaceInfo, hours: readonly ForecastHour[]): ForecastDay[] {
  const byDate = new Map<string, ForecastHour[]>();
  for (const h of hours) {
    const d = dateOf(h.time);
    byDate.set(d, [...(byDate.get(d) ?? []), h]);
  }
  return [...byDate.entries()].map(([date, hs]) => {
    const sun = sunTimes(c.lat, c.lon, date, place.utcOffsetSeconds);
    const max = (f: (h: ForecastHour) => number) => Math.max(...hs.map(f));
    const min = (f: (h: ForecastHour) => number) => Math.min(...hs.map(f));
    const sum = (f: (h: ForecastHour) => number) => hs.reduce((a, h) => a + f(h), 0);
    return {
      date,
      weatherCode: mostSevereCode(hs.map((h) => h.weatherCode)) ?? 3,
      temperatureMax: max((h) => h.temperature),
      temperatureMin: min((h) => h.temperature),
      feelsLikeMax: max((h) => h.feelsLike),
      feelsLikeMin: min((h) => h.feelsLike),
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      uvIndexMax: round(max((h) => h.uvIndex), 0.05),
      precipitationSum: round(sum((h) => h.precipitation), 0.1),
      snowfallSum: round(sum((h) => h.snowfall), 0.01),
      precipitationProbabilityMax: max((h) => h.precipitationProbability),
      windSpeedMax: max((h) => h.windSpeed),
      windGustMax: max((h) => h.windGust),
    };
  });
}

/** Local date "today" at the location. */
export function localToday(place: PlaceInfo, now: Date): string {
  return dateOf(localTimeAt(now, place.utcOffsetSeconds));
}

/** Local "now" floored to 15 minutes, like Open-Meteo's current block. */
export function localCurrentTime(place: PlaceInfo, now: Date): string {
  const local = localTimeAt(now, place.utcOffsetSeconds);
  const minutes = Math.floor(Number(local.slice(14, 16)) / 15) * 15;
  return `${local.slice(0, 14)}${String(minutes).padStart(2, '0')}`;
}

// ---------- Air quality ----------

export function airAt(c: Coords, place: PlaceInfo, instant: Date): AirReading {
  const key = coordKey(c.lat, c.lon);
  const local = localTimeAt(instant, place.utcOffsetSeconds);
  const doy = dayOfYear(local);
  const t = instant.getTime() / DAY_MS;
  const hour = Number(local.slice(11, 13));
  const winter = Math.max(0, Math.cos((2 * Math.PI * (doy - 15)) / 365.25)) * (c.lat >= 0 ? 1 : 0);
  const spring = Math.max(0, Math.cos((2 * Math.PI * (doy - 100)) / 365.25));
  const mongolia = inBox(c, 40, 53, 85, 122);
  const eastAsia = inBox(c, 22, 45, 100, 142);
  const southAsia = inBox(c, 8, 32, 68, 92);

  let pm25 = 8 + (eastAsia ? 14 : 0) + (southAsia ? 45 : 0) + (mongolia ? 15 + 110 * winter : 10 * winter);
  pm25 *= 1 + 0.35 * Math.cos((2 * Math.PI * (hour - 22)) / 24); // night-time inversions
  pm25 *= Math.max(0.25, 1 + 0.45 * smooth(`${key}:pm`, t, [[2.7, 0.7], [6.1, 0.5]]));
  const dust = (eastAsia || mongolia ? 70 : 10) * spring * Math.max(0, smooth(`${key}:dust`, t, [[3.7, 1]]) - 0.3);
  const pm10 = pm25 * 1.55 + dust;
  const daylight = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 14));
  const o3 = 25 + 70 * daylight * (0.6 + 0.4 * (1 - winter));
  const rush = Math.exp(-((hour - 8) ** 2) / 4) + Math.exp(-((hour - 19) ** 2) / 5);
  const no2 = 12 + 28 * rush + (mongolia ? 20 * winter : 0);
  const so2 = 3 + (mongolia ? 70 * winter : eastAsia ? 6 : 2);
  const co = 220 + 300 * rush + (mongolia ? 1600 * winter : 150 * winter);
  const r = (v: number) => Math.round(v * 10) / 10;
  return { time: local, pm10: r(pm10), pm25: r(pm25), o3: r(o3), no2: r(no2), so2: r(so2), co: Math.round(co) };
}

// ---------- Model comparison ----------

/** Mock per-model behaviour: a stable bias, lead-time drift and precipitation scaling. */
export function modelHours(c: Coords, base: readonly ForecastHour[], model: ModelId, today: string) {
  const key = `${coordKey(c.lat, c.lon)}:${model}`;
  const bias = 1.2 * unit(`${key}:bias`);
  const drift = 0.45 * unit(`${key}:drift`);
  const wetScale = 1 + 0.5 * unit(`${key}:wet`);
  const hasPop = model !== 'jma' && model !== 'meteofrance';
  const t0 = new Date(`${today}T00:00:00Z`).getTime();
  return base.map((h) => {
    const lead = Math.max(0, (new Date(`${h.time}:00Z`).getTime() - t0) / DAY_MS);
    const wobble = (0.3 + 0.2 * lead) * smooth(key, lead, [[1.7, 0.6], [3.3, 0.4]]);
    const temperature = round1(h.temperature + bias + drift * lead + wobble);
    const precipitation = round(h.precipitation * wetScale, 0.1);
    let weatherCode = h.weatherCode;
    if (precipitation < 0.1 && h.precipitation >= 0.1) weatherCode = 3;
    else if (precipitation >= 0.1 && temperature <= 0.5 && h.weatherCode < 70) weatherCode = 71;
    return {
      time: h.time,
      temperature,
      precipitationProbability: hasPop ? Math.round(clamp(h.precipitationProbability * (0.8 + 0.2 * wetScale), 0, 100)) : null,
      precipitation,
      weatherCode,
    };
  });
}

export const MOCK_MODEL_IDS = Object.keys(MODELS) as ModelId[];

