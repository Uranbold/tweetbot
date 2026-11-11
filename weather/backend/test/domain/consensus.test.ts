import { describe, expect, it } from 'vitest';
import { agreementFor, computeConsensus } from '../../src/domain/consensus.js';
import { conditionFromWmo } from '../../src/domain/wmo.js';
import type { ModelForecast } from '../../src/types.js';

const model = (id: ModelForecast['model'], maxes: number[], precip: number[] = maxes.map(() => 0)): ModelForecast => ({
  model: id, label: id, agency: id, hourly: [],
  daily: maxes.map((m, i) => ({ date: `2026-10-0${i + 1}`, temperatureMin: m - 8, temperatureMax: m, precipitationSum: precip[i]!, condition: conditionFromWmo(0) })),
});

describe('BR-06 model agreement', () => {
  it.each([[0, 'high'], [1.9, 'high'], [2, 'medium'], [3.9, 'medium'], [4, 'low'], [9, 'low']])('spread %d → %s', (s, a) => {
    expect(agreementFor(s)).toBe(a);
  });

  it('computes mean and max−min spread of daily maxima per date', () => {
    const c = computeConsensus([model('ecmwf', [20, 10], [1, 4]), model('gfs', [21, 15], [3, 0]), model('icon', [22.5, 12], [2, 2])]);
    expect(c).toEqual([
      { date: '2026-10-01', temperatureMaxMean: 21.2, temperatureMaxSpread: 2.5, precipitationSumMean: 2, agreement: 'medium' },
      { date: '2026-10-02', temperatureMaxMean: 12.3, temperatureMaxSpread: 5, precipitationSumMean: 2, agreement: 'low' },
    ]);
  });

  it('handles models with different horizons', () => {
    const c = computeConsensus([model('ecmwf', [20, 20, 20]), model('gfs', [20.5])]);
    expect(c.map((d) => d.agreement)).toEqual(['high', 'high', 'high']);
    expect(c[2]!.temperatureMaxSpread).toBe(0);
  });
});
