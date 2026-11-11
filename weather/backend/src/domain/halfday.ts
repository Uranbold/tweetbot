import type { HalfDay } from '../types.js';
import { conditionFromWmo, mostSevereCode } from './wmo.js';
import { dateOf, hourOf } from '../lib/time.js';

export interface HalfDayInput {
  time: string;
  weatherCode: number;
  precipitationProbability: number;
}

/** BR-07: representative = most severe condition in the window; probability = window maximum. */
export function summarizeHalf(hours: readonly HalfDayInput[], fallbackCode = 3): HalfDay {
  const code = mostSevereCode(hours.map((h) => h.weatherCode)) ?? fallbackCode;
  const pop = hours.reduce((m, h) => Math.max(m, h.precipitationProbability), 0);
  return { condition: conditionFromWmo(code, true), precipitationProbability: Math.round(pop) };
}

/** AM = 00:00–11:59, PM = 12:00–23:59 local on `date`. */
export function splitHalfDays(hours: readonly HalfDayInput[], date: string, fallbackCode = 3): { am: HalfDay; pm: HalfDay } {
  const sameDay = hours.filter((h) => dateOf(h.time) === date);
  return {
    am: summarizeHalf(sameDay.filter((h) => hourOf(h.time) < 12), fallbackCode),
    pm: summarizeHalf(sameDay.filter((h) => hourOf(h.time) >= 12), fallbackCode),
  };
}
