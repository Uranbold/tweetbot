import type { AirGrade, AirQualityReport } from '@contract';

export const AIR_GRADES: readonly AirGrade[] = ['good', 'moderate', 'bad', 'very-bad'] as const;

/** Naver / AirKorea colours: blue, green, orange, red. */
export const AIR_GRADE_COLORS: Record<AirGrade, string> = {
  good: '#3a8bff',
  moderate: '#1eb35a',
  bad: '#f58a1f',
  'very-bad': '#e5484d',
};

export const AIR_GRADE_LABELS: Record<AirGrade, string> = {
  good: 'Good',
  moderate: 'Moderate',
  bad: 'Bad',
  'very-bad': 'Very bad',
};

export const AIR_GRADE_ADVICE: Record<AirGrade, string> = {
  good: 'Air is clean — enjoy outdoor activities.',
  moderate: 'Acceptable air. Sensitive groups should limit long exertion outdoors.',
  bad: 'Wear a mask outdoors and keep windows closed.',
  'very-bad': 'Avoid going out. Use an air purifier indoors.',
};

export function gradeColor(grade: AirGrade | null | undefined): string {
  return grade ? AIR_GRADE_COLORS[grade] : 'var(--text-muted)';
}

export function gradeLabel(grade: AirGrade | null | undefined): string {
  return grade ? AIR_GRADE_LABELS[grade] : 'No data';
}

export function gradeRank(grade: AirGrade): number {
  return AIR_GRADES.indexOf(grade);
}

export function worseGrade(a: AirGrade, b: AirGrade): AirGrade {
  return gradeRank(a) >= gradeRank(b) ? a : b;
}

type ScaleBand = AirQualityReport['scale']['pm10'][number];

/** Grade for a value using the server-supplied thresholds (inclusive bands, open-ended top). */
export function gradeForValue(value: number, scale: ScaleBand[]): AirGrade {
  let result: AirGrade = scale[0]?.grade ?? 'good';
  for (const band of scale) {
    if (value >= band.min) result = band.grade;
  }
  return result;
}

/** Korean MoE default thresholds (used when no scale is available). */
export const DEFAULT_SCALE: AirQualityReport['scale'] = {
  pm10: [
    { grade: 'good', min: 0, max: 30 },
    { grade: 'moderate', min: 31, max: 80 },
    { grade: 'bad', min: 81, max: 150 },
    { grade: 'very-bad', min: 151, max: null },
  ],
  pm25: [
    { grade: 'good', min: 0, max: 15 },
    { grade: 'moderate', min: 16, max: 35 },
    { grade: 'bad', min: 36, max: 75 },
    { grade: 'very-bad', min: 76, max: null },
  ],
};
