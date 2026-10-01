import type { AirGrade } from '@contract';
import { gradeColor, gradeLabel } from '../../lib/air';

/** Colour dot + text label, so the grade never relies on colour alone. */
export function GradeBadge({ grade, size = 'md' }: { grade: AirGrade | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`grade-badge grade-badge--${size}`} data-grade={grade ?? 'none'} style={{ ['--grade' as string]: gradeColor(grade) }}>
      <span className="grade-badge__dot" aria-hidden="true" />
      {gradeLabel(grade)}
    </span>
  );
}
