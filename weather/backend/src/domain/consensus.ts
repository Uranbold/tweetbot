import type { ForecastComparison, ModelForecast } from '../types.js';
import { round1 } from '../lib/geo.js';

type Consensus = ForecastComparison['consensus'][number];

/** BR-06: spread = max − min of the daily maximum across models; high < 2 °C, medium < 4 °C, else low. */
export function agreementFor(spread: number): Consensus['agreement'] {
  if (spread < 2) return 'high';
  if (spread < 4) return 'medium';
  return 'low';
}

export function computeConsensus(models: readonly ModelForecast[]): Consensus[] {
  const dates = [...new Set(models.flatMap((m) => m.daily.map((d) => d.date)))].sort();
  const out: Consensus[] = [];
  for (const date of dates) {
    const days = models.map((m) => m.daily.find((d) => d.date === date)).filter((d) => d !== undefined);
    if (days.length === 0) continue;
    const maxes = days.map((d) => d.temperatureMax);
    const spread = round1(Math.max(...maxes) - Math.min(...maxes));
    out.push({
      date,
      temperatureMaxMean: round1(maxes.reduce((a, b) => a + b, 0) / maxes.length),
      temperatureMaxSpread: spread,
      precipitationSumMean: round1(days.reduce((a, d) => a + d.precipitationSum, 0) / days.length),
      agreement: agreementFor(spread),
    });
  }
  return out;
}
