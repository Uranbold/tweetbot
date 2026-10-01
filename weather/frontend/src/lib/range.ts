export interface RangeBarGeometry {
  /** Left offset in percent of the track. */
  left: number;
  /** Width in percent of the track. */
  width: number;
}

/**
 * Geometry for a weekly min/max range bar scaled to the whole week's [weekMin, weekMax].
 * Always returns a visible sliver (minWidth %) and stays within 0..100.
 */
export function rangeBarGeometry(min: number, max: number, weekMin: number, weekMax: number, minWidth = 4): RangeBarGeometry {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = weekMax - weekMin;
  if (!(span > 0)) return { left: 0, width: 100 };
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  let left = clamp(((lo - weekMin) / span) * 100);
  let width = clamp(((hi - weekMin) / span) * 100) - left;
  if (width < minWidth) {
    width = minWidth;
    left = Math.min(left, 100 - minWidth);
  }
  return { left: round2(left), width: round2(width) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Week extent across daily points. */
export function weekExtent(days: { temperatureMin: number; temperatureMax: number }[]): { min: number; max: number } {
  if (days.length === 0) return { min: 0, max: 0 };
  return {
    min: Math.min(...days.map((d) => d.temperatureMin)),
    max: Math.max(...days.map((d) => d.temperatureMax)),
  };
}

/** Linear scale helper: maps domain [d0,d1] → range [r0,r1]. */
export function linearScale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0;
  return (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}
