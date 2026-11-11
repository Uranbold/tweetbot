import type { Condition, ConditionKey } from '../types.js';

/** WMO 4677 present-weather codes as emitted by Open-Meteo, plus sleet codes from the full table. */
const TABLE: Record<number, readonly [ConditionKey, string]> = {
  0: ['clear', 'Clear'],
  1: ['mostly-clear', 'Mostly clear'],
  2: ['partly-cloudy', 'Partly cloudy'],
  3: ['cloudy', 'Cloudy'],
  45: ['fog', 'Fog'],
  48: ['fog', 'Freezing fog'],
  51: ['drizzle', 'Light drizzle'],
  53: ['drizzle', 'Drizzle'],
  55: ['drizzle', 'Heavy drizzle'],
  56: ['freezing-rain', 'Freezing drizzle'],
  57: ['freezing-rain', 'Heavy freezing drizzle'],
  61: ['rain', 'Light rain'],
  63: ['rain', 'Rain'],
  65: ['heavy-rain', 'Heavy rain'],
  66: ['freezing-rain', 'Freezing rain'],
  67: ['freezing-rain', 'Heavy freezing rain'],
  68: ['sleet', 'Sleet'],
  69: ['sleet', 'Heavy sleet'],
  71: ['snow', 'Light snow'],
  73: ['snow', 'Snow'],
  75: ['heavy-snow', 'Heavy snow'],
  77: ['snow', 'Snow grains'],
  79: ['sleet', 'Ice pellets'],
  80: ['rain', 'Light showers'],
  81: ['rain', 'Showers'],
  82: ['heavy-rain', 'Violent showers'],
  83: ['sleet', 'Sleet showers'],
  84: ['sleet', 'Heavy sleet showers'],
  85: ['snow', 'Snow showers'],
  86: ['heavy-snow', 'Heavy snow showers'],
  95: ['thunderstorm', 'Thunderstorm'],
  96: ['thunderstorm', 'Thunderstorm with hail'],
  99: ['thunderstorm', 'Thunderstorm with heavy hail'],
};

/** Coarse mapping for codes outside the table, by WMO decade. */
function fallback(code: number): readonly [ConditionKey, string] {
  if (code < 4) return ['cloudy', 'Cloudy'];
  if (code < 20) return ['fog', 'Haze'];
  if (code < 30) return ['cloudy', 'Cloudy'];
  if (code < 40) return ['fog', 'Blowing dust or snow'];
  if (code < 50) return ['fog', 'Fog'];
  if (code < 60) return ['drizzle', 'Drizzle'];
  if (code < 70) return ['rain', 'Rain'];
  if (code < 80) return ['snow', 'Snow'];
  if (code < 85) return ['rain', 'Showers'];
  if (code < 91) return ['snow', 'Snow showers'];
  return ['thunderstorm', 'Thunderstorm'];
}

export function conditionFromWmo(code: number, isDay = true): Condition {
  const c = Number.isFinite(code) ? Math.max(0, Math.min(99, Math.round(code))) : 3;
  const [key, label] = TABLE[c] ?? fallback(c);
  return { code: c, key, label: !isDay && key === 'clear' ? 'Clear night' : label, isDay };
}

/** Ordering used to pick the "most severe" condition in a window (BR-07). */
const SEVERITY: Record<ConditionKey, number> = {
  clear: 0,
  'mostly-clear': 1,
  'partly-cloudy': 2,
  cloudy: 3,
  fog: 4,
  drizzle: 5,
  rain: 6,
  snow: 7,
  sleet: 8,
  'freezing-rain': 9,
  'heavy-rain': 10,
  'heavy-snow': 11,
  thunderstorm: 12,
};

export function conditionSeverity(key: ConditionKey): number {
  return SEVERITY[key];
}

/** Severity of a raw WMO code; ties within a key are broken by the code itself (e.g. 63 > 61). */
export function codeSeverity(code: number): number {
  return conditionSeverity(conditionFromWmo(code).key) * 100 + code;
}

export function mostSevereCode(codes: readonly number[]): number | undefined {
  let best: number | undefined;
  for (const c of codes) if (best === undefined || codeSeverity(c) > codeSeverity(best)) best = c;
  return best;
}

const PRECIP_KEYS = new Set<ConditionKey>(['drizzle', 'rain', 'heavy-rain', 'freezing-rain', 'snow', 'heavy-snow', 'sleet', 'thunderstorm']);

export function isPrecipitating(key: ConditionKey): boolean {
  return PRECIP_KEYS.has(key);
}

export function isSnowy(key: ConditionKey): boolean {
  return key === 'snow' || key === 'heavy-snow';
}
