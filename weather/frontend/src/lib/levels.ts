import type { IndexLevel, AlertSeverity } from '@contract';

export const LEVEL_LABELS: Record<IndexLevel, string> = {
  'very-low': 'Very low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very-high': 'Very high',
};

export const LEVEL_COLORS: Record<IndexLevel, string> = {
  'very-low': '#3a8bff',
  low: '#1eb35a',
  moderate: '#e8a400',
  high: '#f58a1f',
  'very-high': '#e5484d',
};

/** 0..4 position for drawing level meters. */
export const LEVEL_STEP: Record<IndexLevel, number> = { 'very-low': 0, low: 1, moderate: 2, high: 3, 'very-high': 4 };

export const SEVERITY_LABELS: Record<AlertSeverity, string> = { advisory: 'Advisory', warning: 'Warning' };

/** UV index (WHO) → level. */
export function uvLevel(uv: number): IndexLevel {
  if (uv < 3) return 'low';
  if (uv < 6) return 'moderate';
  if (uv < 8) return 'high';
  return 'very-high';
}
