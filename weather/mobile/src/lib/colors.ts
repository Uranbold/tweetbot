import type { AirGrade, AlertSeverity, IndexLevel } from '@contract';

/** Korean (AirKorea / Naver) 4-tier colours: good blue, moderate green, bad orange, very-bad red. */
export const GRADE_COLORS: Record<AirGrade, string> = {
  good: '#1e88e5',
  moderate: '#43a047',
  bad: '#fb8c00',
  'very-bad': '#e53935',
};

export const GRADE_ORDER: AirGrade[] = ['good', 'moderate', 'bad', 'very-bad'];

export function gradeColor(grade: AirGrade): string {
  return GRADE_COLORS[grade];
}

export function gradeRank(grade: AirGrade): number {
  return GRADE_ORDER.indexOf(grade);
}

/** Naver: 주의보 (advisory) amber, 경보 (warning) red. */
export const SEVERITY_COLORS: Record<AlertSeverity, { bg: string; fg: string; border: string }> = {
  advisory: { bg: '#fff4d6', fg: '#8a5a00', border: '#f5b400' },
  warning: { bg: '#ffe3e3', fg: '#9b1c1c', border: '#e5484d' },
};

export function severityColor(severity: AlertSeverity): string {
  return SEVERITY_COLORS[severity].border;
}

/** Colour for a 0–1 probability bar: green → amber → red. */
export function probabilityColor(p: number, severity: AlertSeverity = 'advisory'): string {
  if (severity === 'warning' && p >= 0.5) return '#e5484d';
  if (p >= 0.7) return '#e5484d';
  if (p >= 0.4) return '#f5b400';
  return '#43a047';
}

export const INDEX_LEVEL_COLORS: Record<IndexLevel, string> = {
  'very-low': '#1e88e5',
  low: '#43a047',
  moderate: '#f5b400',
  high: '#fb8c00',
  'very-high': '#e53935',
};
