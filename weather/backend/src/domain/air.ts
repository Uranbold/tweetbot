import type { AirGrade, AirQualityReport } from '../types.js';

export type GradeBand = { grade: AirGrade; min: number; max: number | null };

/** BR-01: Korean Ministry of Environment 4-tier scale (µg/m³, inclusive integer bands). */
export const PM10_SCALE: readonly GradeBand[] = [
  { grade: 'good', min: 0, max: 30 },
  { grade: 'moderate', min: 31, max: 80 },
  { grade: 'bad', min: 81, max: 150 },
  { grade: 'very-bad', min: 151, max: null },
];

export const PM25_SCALE: readonly GradeBand[] = [
  { grade: 'good', min: 0, max: 15 },
  { grade: 'moderate', min: 16, max: 35 },
  { grade: 'bad', min: 36, max: 75 },
  { grade: 'very-bad', min: 76, max: null },
];

export function airScale(): AirQualityReport['scale'] {
  return { pm10: PM10_SCALE.map((b) => ({ ...b })), pm25: PM25_SCALE.map((b) => ({ ...b })) };
}

const RANK: Record<AirGrade, number> = { good: 0, moderate: 1, bad: 2, 'very-bad': 3 };

export function gradeRank(g: AirGrade): number {
  return RANK[g];
}

/** Concentrations are rounded to the nearest integer (as AirKorea reports them) before banding. */
function gradeFor(scale: readonly GradeBand[], value: number): AirGrade {
  const v = Math.max(0, Math.round(value));
  for (const band of scale) if (band.max === null || v <= band.max) return band.grade;
  return 'very-bad';
}

export const pm10Grade = (v: number): AirGrade => gradeFor(PM10_SCALE, v);
export const pm25Grade = (v: number): AirGrade => gradeFor(PM25_SCALE, v);

export function worseGrade(a: AirGrade, b: AirGrade): AirGrade {
  return RANK[a] >= RANK[b] ? a : b;
}

export function overallGrade(pm10: number, pm25: number): AirGrade {
  return worseGrade(pm10Grade(pm10), pm25Grade(pm25));
}

export function gradeAtLeast(g: AirGrade, threshold: AirGrade): boolean {
  return RANK[g] >= RANK[threshold];
}

export const GRADE_LABEL: Record<AirGrade, string> = {
  good: 'Good',
  moderate: 'Moderate',
  bad: 'Bad',
  'very-bad': 'Very bad',
};

/** US EPA AQI from PM2.5 (24 h breakpoints, 2024 revision) — used by mocks when no upstream AQI exists. */
export function usAqiFromPm25(pm25: number): number {
  const bp: [number, number, number, number][] = [
    [0, 9, 0, 50],
    [9.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300],
    [225.5, 325.4, 301, 500],
  ];
  const c = Math.max(0, Math.round(pm25 * 10) / 10);
  for (const [cl, ch, il, ih] of bp) if (c <= ch) return Math.round(((ih - il) / (ch - cl)) * (c - cl) + il);
  return 500;
}
