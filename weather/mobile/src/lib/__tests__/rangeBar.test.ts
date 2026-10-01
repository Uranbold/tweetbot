import { computeRangeBar, globalExtent } from '../rangeBar';

describe('computeRangeBar', () => {
  it('maps a span onto the global extent as percentages', () => {
    expect(computeRangeBar(0, 10, -10, 30)).toEqual({ leftPct: 25, widthPct: 25 });
    expect(computeRangeBar(-10, 30, -10, 30)).toEqual({ leftPct: 0, widthPct: 100 });
  });

  it('clamps out-of-range values', () => {
    const g = computeRangeBar(-20, 40, -10, 30);
    expect(g.leftPct).toBe(0);
    expect(g.widthPct).toBe(100);
  });

  it('enforces a minimum width and keeps the bar inside the track', () => {
    const g = computeRangeBar(30, 30, -10, 30, 4);
    expect(g.widthPct).toBe(4);
    expect(g.leftPct + g.widthPct).toBeLessThanOrEqual(100);
  });

  it('handles a degenerate global extent', () => {
    expect(computeRangeBar(5, 5, 5, 5)).toEqual({ leftPct: 0, widthPct: 100 });
  });

  it('tolerates swapped min/max', () => {
    expect(computeRangeBar(10, 0, -10, 30)).toEqual({ leftPct: 25, widthPct: 25 });
  });
});

describe('globalExtent', () => {
  it('finds the overall min/max', () => {
    expect(
      globalExtent([
        { temperatureMin: -1, temperatureMax: 14 },
        { temperatureMin: -11, temperatureMax: 2 },
        { temperatureMin: 1, temperatureMax: 15 },
      ]),
    ).toEqual({ min: -11, max: 15 });
    expect(globalExtent([])).toEqual({ min: 0, max: 0 });
  });
});
