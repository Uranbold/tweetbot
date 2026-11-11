import type { AirGrade, AirQualityReport } from '@contract';

export const AIR_GRADES: readonly AirGrade[] = ['good', 'moderate', 'bad', 'very-bad'] as const;

/** Naver / AirKorea convention (UX §3.3): blue, green, orange, red — light and dark steps. */
export const AIR_GRADE_HEX: Record<'light' | 'dark', Record<AirGrade, string>> = {
  light: { good: '#2a78d6', moderate: '#1a9e4b', bad: '#e0860a', 'very-bad': '#c7322e' },
  dark: { good: '#4a90e8', moderate: '#3fb760', bad: '#e89a2a', 'very-bad': '#e05a52' },
};

/** Components reference the theme tokens (defined from AIR_GRADE_HEX in global.css). */
export const AIR_GRADE_COLORS: Record<AirGrade, string> = {
  good: 'var(--grade-good)',
  moderate: 'var(--grade-moderate)',
  bad: 'var(--grade-bad)',
  'very-bad': 'var(--grade-very-bad)',
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
  return grade ? AIR_GRADE_COLORS[grade] : 'var(--fg-3)';
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
