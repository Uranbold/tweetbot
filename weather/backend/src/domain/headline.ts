import type { ConditionKey } from '../types.js';
import { conditionFromWmo, isPrecipitating } from './wmo.js';
import { dateOf, hourLabel } from '../lib/time.js';

export interface HeadlineHour {
  time: string;
  weatherCode: number;
  precipitationProbability: number;
  precipitation: number;
  windSpeed?: number;
}

const SKY: Partial<Record<ConditionKey, string>> = {
  clear: 'Clear skies',
  'mostly-clear': 'Mostly clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Foggy',
};

const PRECIP_NOUN: Partial<Record<ConditionKey, string>> = {
  drizzle: 'drizzle',
  rain: 'rain',
  'heavy-rain': 'heavy rain',
  'freezing-rain': 'freezing rain',
  snow: 'snow',
  'heavy-snow': 'heavy snow',
  sleet: 'sleet',
  thunderstorm: 'thunderstorms',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** An hour "has precipitation" when the code is precipitating and it is likely (≥ 50 %) or measurable. */
function wet(h: HeadlineHour): boolean {
  const key = conditionFromWmo(h.weatherCode).key;
  return isPrecipitating(key) && (h.precipitationProbability >= 50 || h.precipitation >= 0.2);
}

function dominantSky(hours: readonly HeadlineHour[]): string {
  const counts = new Map<ConditionKey, number>();
  for (const h of hours) {
    const key = conditionFromWmo(h.weatherCode).key;
    const sky = isPrecipitating(key) ? 'cloudy' : key;
    counts.set(sky, (counts.get(sky) ?? 0) + 1);
  }
  let best: ConditionKey = 'cloudy';
  let n = -1;
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c];
  return SKY[best] ?? 'Cloudy';
}

function when(nowTime: string, t: string): string {
  return dateOf(t) === dateOf(nowTime) ? hourLabel(t) : `${hourLabel(t)} tomorrow`;
}

function precipNoun(hours: readonly HeadlineHour[]): string {
  // Name the most common precipitation type among the wet hours.
  const counts = new Map<string, number>();
  for (const h of hours) {
    const noun = PRECIP_NOUN[conditionFromWmo(h.weatherCode).key];
    if (noun) counts.set(noun, (counts.get(noun) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'rain';
}

/**
 * Natural-language headline for the next 24 hours, e.g.
 * "Clear skies, rain likely after 6 PM", "Rain easing around 3 PM", "Partly cloudy, staying dry".
 * `hours` must start at the current hour.
 */
export function buildHeadline(hours: readonly HeadlineHour[]): string {
  const window = hours.slice(0, 24);
  if (window.length === 0) return 'Forecast unavailable';
  const now = window[0]!.time;
  const wetIdx = window.map((h, i) => (wet(h) ? i : -1)).filter((i) => i >= 0);
  const windy = window.some((h) => (h.windSpeed ?? 0) >= 9) ? ', windy at times' : '';

  if (wetIdx.length === 0) {
    return `${dominantSky(window)}, staying dry${windy}`;
  }
  const noun = precipNoun(wetIdx.map((i) => window[i]!));
  if (wetIdx[0]! <= 1) {
    // Precipitating now: when does it stop (first 2 consecutive dry hours)?
    let stop = -1;
    for (let i = 1; i + 1 < window.length; i++) {
      if (!wet(window[i]!) && !wet(window[i + 1]!)) {
        stop = i;
        break;
      }
    }
    if (stop < 0) return `${capitalize(noun)} continuing through the next 24 hours${windy}`;
    const after = window.slice(stop);
    const returns = after.some(wet);
    return `${capitalize(noun)} easing around ${when(now, window[stop]!.time)}${returns ? ', more later' : `, then ${dominantSky(after).toLowerCase()}`}`;
  }
  const first = window[wetIdx[0]!]!;
  return `${dominantSky(window.slice(0, wetIdx[0]))}, ${noun} likely after ${when(now, first.time)}${windy}`;
}
