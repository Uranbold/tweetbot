import type { Location, ModelId } from '../../types.js';
import { searchCities } from '../../data/cities.js';
import { usAqiFromPm25 } from '../../domain/air.js';
import { mostSevereCode } from '../../domain/wmo.js';
import { addDays, dateOf, instantOf } from '../../lib/time.js';
import { cityToLocation, reverseFromCatalog } from '../catalog.js';
import type {
  AirData, AirQualityProvider, AirReading, Coords, Forecast, GeocodingProvider, ModelComparisonData, ModelComparisonProvider,
  ModelDay, PointSnapshot, Sourced, WeatherProvider,
} from '../ports.js';
import { aggregateDays, airAt, hoursFrom, localCurrentTime, localToday, mockPlace, modelHours } from './climate.js';

export const MOCK = 'mock';

export interface MockOptions {
  now?: () => Date;
}

abstract class MockBase {
  readonly name = MOCK;
  protected readonly now: () => Date;
  constructor(opts: MockOptions = {}) {
    this.now = opts.now ?? (() => new Date());
  }
  protected sourced<T>(value: T): Sourced<T> {
    return { value, source: { provider: MOCK, mock: true, fetchedAt: this.now().toISOString() } };
  }
}

export class MockWeatherProvider extends MockBase implements WeatherProvider {
  buildForecast(c: Coords, now: Date): Forecast {
    const place = mockPlace(c, now);
    const today = localToday(place, now);
    const hourly = hoursFrom(c, place, addDays(today, -1), 11); // past_days=1 + forecast_days=10
    const daily = aggregateDays(c, place, hourly);
    const time = localCurrentTime(place, now);
    const idx = hourly.findIndex((h) => h.time === `${time.slice(0, 13)}:00`);
    const h0 = hourly[idx]!;
    const h1 = hourly[idx + 1] ?? h0;
    const f = Number(time.slice(14, 16)) / 60;
    const lerp = (a: number, b: number) => Math.round((a + (b - a) * f) * 10) / 10;
    return {
      place,
      current: {
        time,
        temperature: lerp(h0.temperature, h1.temperature),
        feelsLike: lerp(h0.feelsLike, h1.feelsLike),
        humidity: h0.humidity,
        precipitation: h0.precipitation,
        weatherCode: h0.weatherCode,
        isDay: h0.isDay,
        cloudCover: h0.cloudCover,
        pressure: Math.round((1013 - 9 * ((h0.cloudCover - 50) / 50) + (h0.precipitation > 0 ? -4 : 0)) * 10) / 10,
        windSpeed: h0.windSpeed,
        windDirection: h0.windDirection,
        windGust: h0.windGust,
      },
      hourly,
      daily,
    };
  }

  async getForecast(c: Coords): Promise<Sourced<Forecast>> {
    return this.sourced(this.buildForecast(c, this.now()));
  }

  async getSnapshots(cs: readonly Coords[]): Promise<Sourced<PointSnapshot[]>> {
    const now = this.now();
    return this.sourced(
      cs.map((c) => {
        const place = mockPlace(c, now);
        const today = localToday(place, now);
        const hours = hoursFrom(c, place, today, 1);
        const [day] = aggregateDays(c, place, hours);
        const time = localCurrentTime(place, now);
        const cur = hours.find((h) => h.time === `${time.slice(0, 13)}:00`) ?? hours[0]!;
        return {
          place,
          time,
          temperature: cur.temperature,
          weatherCode: cur.weatherCode,
          isDay: cur.isDay,
          temperatureMin: day!.temperatureMin,
          temperatureMax: day!.temperatureMax,
          precipitationProbabilityMax: day!.precipitationProbabilityMax,
        };
      }),
    );
  }
}

export class MockAirProvider extends MockBase implements AirQualityProvider {
  private reading(c: Coords, instant: Date, place = mockPlace(c, instant)): AirReading {
    const r = airAt(c, place, instant);
    return { ...r, usAqi: usAqiFromPm25(r.pm25) };
  }

  async getAirQuality(c: Coords): Promise<Sourced<AirData>> {
    const now = this.now();
    const place = mockPlace(c, now);
    const start = instantOf(`${localToday(place, now)}T00:00`, place.utcOffsetSeconds).getTime();
    const hourly = Array.from({ length: 96 }, (_, i) => this.reading(c, new Date(start + i * 3_600_000), place));
    const currentHour = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000);
    return this.sourced({ place, current: this.reading(c, currentHour, place), hourly });
  }

  async getCurrentBatch(cs: readonly Coords[]): Promise<Sourced<AirReading[]>> {
    const currentHour = new Date(Math.floor(this.now().getTime() / 3_600_000) * 3_600_000);
    return this.sourced(cs.map((c) => this.reading(c, currentHour)));
  }
}

export class MockGeocodingProvider extends MockBase implements GeocodingProvider {
  async search(query: string, limit: number): Promise<Sourced<Location[]>> {
    const now = this.now();
    return this.sourced(searchCities(query, limit).map((c) => cityToLocation(c, now)));
  }

  async reverse(c: Coords): Promise<Sourced<Location>> {
    return this.sourced(reverseFromCatalog(c, this.now()));
  }
}

export class MockModelProvider extends MockBase implements ModelComparisonProvider {
  private readonly weather: MockWeatherProvider;
  constructor(opts: MockOptions = {}) {
    super(opts);
    this.weather = new MockWeatherProvider(opts);
  }

  async getModels(c: Coords, models: readonly ModelId[]): Promise<Sourced<ModelComparisonData>> {
    const now = this.now();
    const base = this.weather.buildForecast(c, now);
    const today = localToday(base.place, now);
    const horizon = addDays(today, 7);
    const baseHours = base.hourly.filter((h) => dateOf(h.time) >= today && dateOf(h.time) < horizon);
    const runs = models.map((model) => {
      const hourly = modelHours(c, baseHours, model, today);
      const byDate = new Map<string, typeof hourly>();
      for (const h of hourly) byDate.set(dateOf(h.time), [...(byDate.get(dateOf(h.time)) ?? []), h]);
      const daily: ModelDay[] = [...byDate.entries()].map(([date, hs]) => ({
        date,
        temperatureMax: Math.max(...hs.map((h) => h.temperature)),
        temperatureMin: Math.min(...hs.map((h) => h.temperature)),
        precipitationSum: Math.round(hs.reduce((a, h) => a + h.precipitation, 0) * 10) / 10,
        weatherCode: mostSevereCode(hs.map((h) => h.weatherCode)) ?? 3,
      }));
      return { model, hourly, daily };
    });
    return this.sourced({ place: base.place, models: runs });
  }
}
