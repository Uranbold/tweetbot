import type { YesterdayComparison } from '../types.js';
import { round1 } from '../lib/geo.js';

/** BR-03: current temperature vs the same local hour yesterday. */
export function compareWithYesterday(current: number, yesterday: number | null | undefined): YesterdayComparison {
  if (yesterday === null || yesterday === undefined || !Number.isFinite(yesterday)) {
    return { temperatureDiff: 0, message: 'No data for yesterday' };
  }
  const diff = round1(current - yesterday);
  if (Math.abs(diff) < 0.5) return { temperatureDiff: diff === 0 ? 0 : diff, message: 'Same as yesterday' };
  const word = diff > 0 ? 'warmer' : 'cooler';
  return { temperatureDiff: diff, message: `${Math.abs(diff).toFixed(1)}° ${word} than yesterday` };
}
