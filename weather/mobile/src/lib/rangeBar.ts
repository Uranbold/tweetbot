export interface RangeBarGeometry {
  /** Left offset as a 0–100 percentage of the track. */
  leftPct: number;
  /** Width as a 0–100 percentage of the track. */
  widthPct: number;
}

/**
 * Maps a [min, max] temperature span onto a track whose extent is [globalMin, globalMax].
 * Degenerate extents collapse to a full-width bar; results are clamped to [0, 100].
 */
export function computeRangeBar(
  min: number,
  max: number,
  globalMin: number,
  globalMax: number,
  minWidthPct = 4,
): RangeBarGeometry {
  const span = globalMax - globalMin;
  if (!Number.isFinite(span) || span <= 0) return { leftPct: 0, widthPct: 100 };
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const left = clamp(((lo - globalMin) / span) * 100, 0, 100);
  const right = clamp(((hi - globalMin) / span) * 100, 0, 100);
  const width = Math.max(right - left, minWidthPct);
  return { leftPct: clamp(left, 0, 100 - width), widthPct: clamp(width, 0, 100) };
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Overall min/max across a list of {temperatureMin, temperatureMax}. */
export function globalExtent(points: { temperatureMin: number; temperatureMax: number }[]): {
  min: number;
  max: number;
} {
  if (points.length === 0) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.temperatureMin < min) min = p.temperatureMin;
    if (p.temperatureMax > max) max = p.temperatureMax;
  }
  return { min, max };
}
