/**
 * Pure assembly of contract payloads from provider data + domain rules.
 * Kept separate from the services so it can be unit-tested with fixtures.
 */
import type {
  AirHourlyPoint, AirQualityReport, AirQualitySnapshot, CurrentWeather, DailyPoint, ForecastComparison, HourlyPoint, Location,
  ModelForecast, TodayWeather,
} from '../types.js';
import { airScale, overallGrade, pm10Grade, pm25Grade } from '../domain/air.js';
import { deriveAlerts } from '../domain/alerts.js';
import { clothingAdvice } from '../domain/clothing.js';
import { compareWithYesterday } from '../domain/comparison.js';
import { computeConsensus } from '../domain/consensus.js';
import { splitHalfDays } from '../domain/halfday.js';
import { buildHeadline } from '../domain/headline.js';
import { computeLifeIndices, type LifeIndexInput } from '../domain/lifeIndices.js';
import { MODELS } from '../domain/models.js';
import { isDaylight } from '../domain/sun.js';
import { conditionFromWmo, mostSevereCode } from '../domain/wmo.js';
import { compassLabel, round1 } from '../lib/geo.js';
import { addDays, addHours, dateOf, floorHour, instantOf, localTimeAt } from '../lib/time.js';
import type { AirData, AirReading, Forecast, ForecastHour, ModelComparisonData } from '../providers/ports.js';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const max = (xs: number[], dflt = 0) => (xs.length ? Math.max(...xs) : dflt);

/** Index of the hour containing `time` (falls back to the last hour not after it). */
export function hourIndex(hours: readonly { time: string }[], time: string): number {
  const target = floorHour(time);
  const exact = hours.findIndex((h) => h.time === target);
  if (exact >= 0) return exact;
  let idx = 0;
  for (let i = 0; i < hours.length; i++) if (hours[i]!.time <= target) idx = i;
  return idx;
}

export function airSnapshot(r: AirReading): AirQualitySnapshot {
  const s: AirQualitySnapshot = {
    time: r.time,
    pm10: round1(r.pm10),
    pm25: round1(r.pm25),
    o3: round1(r.o3),
    no2: round1(r.no2),
    so2: round1(r.so2),
    co: round1(r.co),
    pm10Grade: pm10Grade(r.pm10),
    pm25Grade: pm25Grade(r.pm25),
    overallGrade: overallGrade(r.pm10, r.pm25),
  };
  if (r.usAqi !== undefined) s.usAqi = Math.round(r.usAqi);
  return s;
}

function hourlyPoint(h: ForecastHour): HourlyPoint {
  return {
    time: h.time,
    temperature: h.temperature,
    feelsLike: h.feelsLike,
    condition: conditionFromWmo(h.weatherCode, h.isDay),
    precipitationProbability: Math.round(h.precipitationProbability),
    precipitation: h.precipitation,
    snowfall: h.snowfall,
    humidity: Math.round(h.humidity),
    windSpeed: h.windSpeed,
    windDirection: Math.round(h.windDirection),
    uvIndex: h.uvIndex,
  };
}

export function lifeIndexInput(f: Forecast, idx: number, airGrade: LifeIndexInput['airGrade']): LifeIndexInput {
  const today = dateOf(f.current.time);
  const next12 = f.hourly.slice(idx, idx + 12);
  const next24 = f.hourly.slice(idx, idx + 24);
  const next48 = f.hourly.slice(idx, idx + 48);
  const todayHours = f.hourly.filter((h) => dateOf(h.time) === today);
  const todayDaily = f.daily.find((d) => d.date === today);
  const hottest = next24.reduce((a, h) => (h.temperature > a.temperature ? h : a), next24[0] ?? f.hourly[idx]!);
  return {
    temperature: f.current.temperature,
    humidity: f.current.humidity,
    windSpeed: f.current.windSpeed,
    uvIndexMax: todayDaily?.uvIndexMax ?? max(todayHours.map((h) => h.uvIndex)),
    next12hMaxPrecipProbability: max(next12.map((h) => h.precipitationProbability)),
    next12hMeanHumidity: mean(next12.map((h) => h.humidity)),
    next12hMeanWind: mean(next12.map((h) => h.windSpeed)),
    next12hMeanCloudCover: mean(next12.map((h) => h.cloudCover)),
    next48hPrecipitationSum: next48.reduce((a, h) => a + h.precipitation, 0),
    next48hMaxPrecipProbability: max(next48.map((h) => h.precipitationProbability)),
    next24hMaxTemperature: hottest?.temperature ?? f.current.temperature,
    humidityAtMaxTemperature: hottest?.humidity ?? f.current.humidity,
    todayMaxTemperature: todayDaily?.temperatureMax ?? max(todayHours.map((h) => h.temperature)),
    todayMeanHumidity: mean(todayHours.map((h) => h.humidity)),
    airGrade,
  };
}

export function assembleToday(f: Forecast, air: AirData | null, location: Location): TodayWeather {
  const idx = hourIndex(f.hourly, f.current.time);
  const nowHour = f.hourly[idx]!;
  const today = dateOf(f.current.time);
  const hourly = f.hourly.slice(idx, idx + 48);

  const yesterdayTime = addHours(floorHour(f.current.time), -24);
  const yesterday = f.hourly.find((h) => h.time === yesterdayTime)?.temperature;

  const days = f.daily.filter((d) => d.date >= today).slice(0, 10);
  const daily: DailyPoint[] = days.map((d) => {
    const { am, pm } = splitHalfDays(f.hourly, d.date, d.weatherCode);
    return {
      date: d.date,
      temperatureMin: d.temperatureMin,
      temperatureMax: d.temperatureMax,
      am,
      pm,
      precipitationSum: round1(d.precipitationSum),
      snowfallSum: round1(d.snowfallSum),
      sunrise: d.sunrise,
      sunset: d.sunset,
      uvIndexMax: d.uvIndexMax,
      windSpeedMax: d.windSpeedMax,
    };
  });
  const todayDaily = days[0];

  const current: CurrentWeather = {
    time: f.current.time,
    temperature: f.current.temperature,
    feelsLike: f.current.feelsLike,
    condition: conditionFromWmo(f.current.weatherCode, f.current.isDay),
    humidity: Math.round(f.current.humidity),
    windSpeed: f.current.windSpeed,
    windGust: f.current.windGust,
    windDirection: Math.round(f.current.windDirection),
    windDirectionLabel: compassLabel(f.current.windDirection),
    precipitation: f.current.precipitation,
    pressure: f.current.pressure,
    cloudCover: Math.round(f.current.cloudCover),
    visibility: round1(nowHour.visibility),
    uvIndex: nowHour.uvIndex,
  };

  const airSnap = air ? airSnapshot(air.current) : null;
  const airHours = air ? air.hourly.slice(hourIndex(air.hourly, air.current.time), hourIndex(air.hourly, air.current.time) + 72) : [];

  const alerts = deriveAlerts({
    hourly: f.hourly.slice(idx, idx + 72),
    daily: f.daily,
    fromDate: today,
    toDate: addDays(today, 3),
    air: airHours.map((h) => ({ time: h.time, grade: overallGrade(h.pm10, h.pm25) })),
  });

  const lifeInput = lifeIndexInput(f, idx, airSnap?.overallGrade ?? null);

  return {
    location,
    current,
    comparison: compareWithYesterday(f.current.temperature, yesterday),
    today: {
      temperatureMin: todayDaily?.temperatureMin ?? f.current.temperature,
      temperatureMax: todayDaily?.temperatureMax ?? f.current.temperature,
      sunrise: todayDaily?.sunrise ?? '',
      sunset: todayDaily?.sunset ?? '',
      headline: buildHeadline(hourly),
    },
    hourly: hourly.map(hourlyPoint),
    daily,
    air: airSnap,
    lifeIndices: computeLifeIndices(lifeInput),
    alerts,
    clothing: clothingAdvice(f.current.temperature, { precipitationProbability: lifeInput.next12hMaxPrecipProbability }),
  };
}

export function assembleAirReport(a: AirData, location: Location): AirQualityReport {
  const idx = hourIndex(a.hourly, a.current.time);
  const hourly: AirHourlyPoint[] = a.hourly.slice(idx, idx + 72).map((h) => ({
    time: h.time,
    pm10: round1(h.pm10),
    pm25: round1(h.pm25),
    o3: round1(h.o3),
    pm10Grade: pm10Grade(h.pm10),
    pm25Grade: pm25Grade(h.pm25),
  }));
  const today = dateOf(a.current.time);
  const byDate = new Map<string, AirReading[]>();
  for (const h of a.hourly) {
    const d = dateOf(h.time);
    if (d >= today) byDate.set(d, [...(byDate.get(d) ?? []), h]);
  }
  const daily = [...byDate.entries()].slice(0, 4).map(([date, hs]) => {
    const pm10Max = Math.round(max(hs.map((h) => h.pm10)));
    const pm25Max = Math.round(max(hs.map((h) => h.pm25)));
    return { date, pm10Grade: pm10Grade(pm10Max), pm25Grade: pm25Grade(pm25Max), pm10Max, pm25Max };
  });
  return { location, current: airSnapshot(a.current), hourly, daily, scale: airScale() };
}

export function assembleComparison(d: ModelComparisonData, location: Location, now: Date): ForecastComparison {
  const { utcOffsetSeconds } = d.place;
  const nowHour = floorHour(localTimeAt(now, utcOffsetSeconds));
  const today = dateOf(nowHour);
  const models: ModelForecast[] = d.models.map((run) => {
    const meta = MODELS[run.model];
    const hourly = run.hourly
      .filter((h) => h.time >= nowHour)
      .slice(0, 48)
      .map((h) => ({
        time: h.time,
        temperature: h.temperature,
        precipitationProbability: h.precipitationProbability === null ? null : Math.round(h.precipitationProbability),
        precipitation: h.precipitation,
        condition: conditionFromWmo(h.weatherCode, isDaylight(location.lat, location.lon, instantOf(h.time, utcOffsetSeconds))),
      }));
    const daily = run.daily
      .filter((x) => x.date >= today)
      .slice(0, 7)
      .map((x) => {
        const code = x.weatherCode ?? mostSevereCode(run.hourly.filter((h) => dateOf(h.time) === x.date).map((h) => h.weatherCode)) ?? 3;
        return {
          date: x.date,
          temperatureMin: x.temperatureMin,
          temperatureMax: x.temperatureMax,
          precipitationSum: round1(x.precipitationSum),
          condition: conditionFromWmo(code, true),
        };
      });
    return { model: run.model, label: meta.label, agency: meta.agency, hourly, daily };
  });
  return { location, models, consensus: computeConsensus(models) };
}

