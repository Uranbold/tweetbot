import type { AirGrade, IndexLevel, LifeIndex } from '../types.js';
import { clothingAdvice } from './clothing.js';
import { heatIndex, heatIndexApplies, windChill, windChillApplies } from './feelsLike.js';
import { round1 } from '../lib/geo.js';

/** Aggregates the service derives from the forecast; keeps the rules free of array plumbing. */
export interface LifeIndexInput {
  temperature: number; // current °C
  humidity: number; // current %
  windSpeed: number; // current m/s
  uvIndexMax: number; // today's max UV
  /** Daytime aggregates over the next 12 h. */
  next12hMaxPrecipProbability: number;
  next12hMeanHumidity: number;
  next12hMeanWind: number;
  next12hMeanCloudCover: number; // %
  next48hPrecipitationSum: number; // mm (rain + melted snow)
  next48hMaxPrecipProbability: number;
  /** Hottest hour in the next 24 h with its humidity (heat index). */
  next24hMaxTemperature: number;
  humidityAtMaxTemperature: number;
  todayMaxTemperature: number;
  todayMeanHumidity: number;
  airGrade: AirGrade | null;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** Suitability score 0–100 → level (higher is better). */
function suitability(score: number): IndexLevel {
  if (score >= 80) return 'very-high';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'low';
  return 'very-low';
}

/** BR-05: WHO UV bands. IndexLevel has no "extreme", so 11+ shares very-high with distinct advice. */
export function uvIndex(uv: number): LifeIndex {
  const v = round1(Math.max(0, uv));
  const [level, advice]: [IndexLevel, string] =
    v < 3 ? ['low', 'Low UV — no protection needed'] :
    v < 6 ? ['moderate', 'Moderate UV — wear sunscreen at midday'] :
    v < 8 ? ['high', 'High UV — sunscreen, hat and sunglasses'] :
    v < 11 ? ['very-high', 'Very high UV — avoid midday sun'] :
    ['very-high', 'Extreme UV — stay indoors around noon'];
  return { key: 'uv', label: 'UV index', level, value: v, advice };
}

export function laundryIndex(i: LifeIndexInput): LifeIndex {
  let score = 100;
  score -= i.next12hMaxPrecipProbability * 0.8;
  score -= Math.max(0, i.next12hMeanHumidity - 40) * 0.7;
  score -= i.next12hMeanCloudCover * 0.15;
  if (i.next12hMeanWind >= 1.5 && i.next12hMeanWind <= 7) score += 5; // a breeze helps
  else if (i.next12hMeanWind > 10) score -= 10; // laundry blows away
  if (i.temperature < 0) score -= 15; // freezes on the line
  if (i.next12hMaxPrecipProbability >= 70) score = Math.min(score, 15);
  const s = Math.round(clamp(score));
  const level = suitability(s);
  const advice: Record<IndexLevel, string> = {
    'very-high': 'Great day for laundry',
    high: 'Good for drying laundry outside',
    moderate: 'Laundry dries slowly — hang it in the sun',
    low: 'Poor drying conditions — consider drying indoors',
    'very-low': 'Dry laundry indoors today',
  };
  return { key: 'laundry', label: 'Laundry', level, value: s, advice: advice[level] };
}

export function carWashIndex(i: LifeIndexInput): LifeIndex {
  const sum = i.next48hPrecipitationSum;
  const pop = i.next48hMaxPrecipProbability;
  const [level, advice]: [IndexLevel, string] =
    sum < 0.5 && pop < 30 ? ['very-high', 'Great day for a car wash — dry for the next 2 days'] :
    sum < 1 && pop < 50 ? ['high', 'Good for a car wash'] :
    sum < 3 ? ['moderate', 'Some showers possible in the next 48 h'] :
    sum < 10 ? ['low', 'Rain expected within 48 h — maybe wait'] :
    ['very-low', 'Rain expected — postpone the car wash'];
  return { key: 'car-wash', label: 'Car wash', level, value: round1(sum), advice };
}

export function clothingIndex(i: LifeIndexInput): LifeIndex {
  const t = Math.round(i.temperature);
  const level: IndexLevel = t <= 4 ? 'very-low' : t <= 11 ? 'low' : t <= 19 ? 'moderate' : t <= 27 ? 'high' : 'very-high';
  const advice = clothingAdvice(i.temperature, { precipitationProbability: i.next12hMaxPrecipProbability }).summary;
  return { key: 'clothing', label: 'Clothing', level, value: round1(i.temperature), advice };
}

export function outdoorActivityIndex(i: LifeIndexInput): LifeIndex {
  let score = 100;
  const airPenalty: Record<AirGrade, number> = { good: 0, moderate: 10, bad: 45, 'very-bad': 75 };
  if (i.airGrade) score -= airPenalty[i.airGrade];
  score -= i.next12hMaxPrecipProbability * 0.5;
  score -= Math.max(0, Math.abs(i.temperature - 19) - 6) * 4; // comfort band 13–25 °C
  if (i.next12hMeanWind > 10) score -= 15;
  const s = Math.round(clamp(score));
  const level = suitability(s);
  let advice: string;
  if (i.airGrade === 'very-bad') advice = 'Very poor air — avoid outdoor exercise (KF94 mask)';
  else if (i.airGrade === 'bad') advice = 'Poor air — limit prolonged outdoor activity (KF80 mask)';
  else if (i.next12hMaxPrecipProbability >= 60) advice = 'Rain likely — plan indoor activities';
  else if (level === 'very-high' || level === 'high') advice = 'Good conditions for outdoor activities';
  else if (i.temperature < 5) advice = 'Cold — dress warmly for outdoor activities';
  else if (i.temperature > 30) advice = 'Hot — avoid strenuous activity at midday';
  else advice = 'Fair conditions for outdoor activities';
  return { key: 'outdoor-activity', label: 'Outdoor activity', level, value: s, advice };
}

export function foodPoisoningIndex(i: LifeIndexInput): LifeIndex {
  const t = i.todayMaxTemperature;
  const rh = i.todayMeanHumidity;
  const [level, advice]: [IndexLevel, string] =
    t >= 30 && rh >= 70 ? ['very-high', 'Very high risk — refrigerate food and eat it promptly'] :
    t >= 25 && rh >= 60 ? ['high', 'High risk — keep food chilled and wash hands'] :
    t >= 20 ? ['moderate', 'Moderate risk — avoid leaving food out'] :
    t >= 10 ? ['low', 'Low risk — normal food hygiene'] :
    ['very-low', 'Very low risk'];
  return { key: 'food-poisoning', label: 'Food poisoning', level, advice };
}

/** Only when T ≥ 27 °C (BR-05). Bands follow NWS caution / extreme caution / danger. */
export function heatIndexIndex(i: LifeIndexInput): LifeIndex | null {
  if (!heatIndexApplies(i.next24hMaxTemperature)) return null;
  const hi = round1(heatIndex(i.next24hMaxTemperature, i.humidityAtMaxTemperature));
  const [level, advice]: [IndexLevel, string] =
    hi < 27 ? ['low', 'Warm but comfortable'] :
    hi < 32 ? ['moderate', 'Caution — fatigue possible with prolonged activity'] :
    hi < 41 ? ['high', 'Extreme caution — drink water and rest in the shade'] :
    hi < 54 ? ['very-high', 'Danger — heat exhaustion likely, avoid outdoor work'] :
    ['very-high', 'Extreme danger — heat stroke imminent, stay indoors'];
  return { key: 'heat-index', label: 'Heat index', level, value: hi, advice };
}

/** Only when T ≤ 10 °C and wind > 1.3 m/s (BR-05). */
export function windChillIndex(i: LifeIndexInput): LifeIndex | null {
  if (!windChillApplies(i.temperature, i.windSpeed)) return null;
  const wc = round1(windChill(i.temperature, i.windSpeed));
  const [level, advice]: [IndexLevel, string] =
    wc > 0 ? ['very-low', 'Chilly breeze — a light jacket is enough'] :
    wc > -10 ? ['low', 'Cold wind — wear a warm coat'] :
    wc > -25 ? ['moderate', 'Very cold — cover exposed skin'] :
    wc > -45 ? ['high', 'Frostbite risk within 10–30 minutes'] :
    ['very-high', 'Severe frostbite risk within minutes — stay indoors'];
  return { key: 'wind-chill', label: 'Wind chill', level, value: wc, advice };
}

export function computeLifeIndices(i: LifeIndexInput): LifeIndex[] {
  return [
    uvIndex(i.uvIndexMax),
    laundryIndex(i),
    carWashIndex(i),
    clothingIndex(i),
    outdoorActivityIndex(i),
    foodPoisoningIndex(i),
    heatIndexIndex(i),
    windChillIndex(i),
  ].filter((x): x is LifeIndex => x !== null);
}
