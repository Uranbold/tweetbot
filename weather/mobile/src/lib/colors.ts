import type { AirGrade, AlertSeverity } from '@contract';
import { darkTheme, lightTheme, type Theme } from '@/theme';

export const GRADE_ORDER: AirGrade[] = ['good', 'moderate', 'bad', 'very-bad'];

/** Grade colour from the token table (§3.3). Defaults to the light palette for non-component code. */
export function gradeColor(grade: AirGrade, theme: Theme = lightTheme): string {
  return theme.colors.grade[grade];
}

export function gradeRank(grade: AirGrade): number {
  return GRADE_ORDER.indexOf(grade);
}

/** Advisory (주의보) amber, warning (경보) red. */
export function severityColor(severity: AlertSeverity, theme: Theme = lightTheme): string {
  return theme.colors.severity[severity];
}

/** Probability bar colour: the risk's own severity colour (status colours are never reused as series). */
export function probabilityColor(severity: AlertSeverity, theme: Theme = lightTheme): string {
  return theme.colors.severity[severity];
}

export const GRADE_COLORS_LIGHT = lightTheme.colors.grade;
export const GRADE_COLORS_DARK = darkTheme.colors.grade;
