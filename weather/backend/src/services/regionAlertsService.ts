import type { AirQualitySnapshot, ApiMeta, HazardRisk, Region, WeatherAlert } from '../types.js';
import type { CacheStatus } from '../cache/readThrough.js';
import type { PredictService } from './predictService.js';
import type { WeatherService } from './weatherService.js';

export interface RegionConditions {
  alerts: WeatherAlert[];
  risks: HazardRisk[];
  air: AirQualitySnapshot | null;
  utcOffsetSeconds: number;
  headline: string;
  temperatureMax: number;
  temperatureMin: number;
  meta: ApiMeta;
  cache: CacheStatus;
  maxAge: number;
}

/** Hazard picture for a notification region: derived alerts + AI risks (best effort) + air. */
export class RegionAlertsService {
  constructor(
    private readonly weather: WeatherService,
    private readonly predict: PredictService,
  ) {}

  async conditions(region: Region): Promise<RegionConditions> {
    const c = { lat: region.lat, lon: region.lon };
    const [wx, risks] = await Promise.all([
      this.weather.getToday(c),
      this.predict
        .get(c, 72)
        .then((r) => r.body.data.risks ?? [])
        .catch(() => [] as HazardRisk[]),
    ]);
    const d = wx.body.data;
    return {
      alerts: d.alerts,
      risks,
      air: d.air,
      utcOffsetSeconds: d.location.utcOffsetSeconds,
      headline: d.today.headline,
      temperatureMax: d.today.temperatureMax,
      temperatureMin: d.today.temperatureMin,
      meta: wx.body.meta,
      cache: wx.cache,
      maxAge: wx.maxAge,
    };
  }
}
