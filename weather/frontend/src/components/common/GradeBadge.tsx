import type { AirGrade } from '@contract';
import { gradeColor, gradeLabel } from '../../lib/air';
import { GradeFace } from '../icons/GradeFace';

/**
 * The single grade chip (UX §4.5, law of similarity): face glyph + label (+ value), tinted ground,
 * --fg text. Colour is never the only channel.
 */
export function GradeChip({
  grade,
  name,
  value,
  unit,
  size = 'md',
}: {
  grade: AirGrade | null | undefined;
  /** Leading pollutant name, e.g. "PM2.5". */
  name?: string;
  value?: number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const parts = [name, gradeLabel(grade), value != null ? `${Math.round(value)}${unit ? ` ${unit}` : ''}` : null].filter(Boolean);
  return (
    <span className={`grade-chip grade-chip--${size}`} data-grade={grade ?? 'none'} data-testid="grade-chip" style={{ ['--grade' as string]: gradeColor(grade) }}>
      <GradeFace grade={grade} size={size === 'lg' ? 20 : 16} />
      <span className="grade-chip__text">
        {parts.map((p, i) => (
          <span key={i} className={i === (name ? 1 : 0) ? 'grade-chip__grade' : 'grade-chip__meta'}>
            {i > 0 && <span aria-hidden="true"> · </span>}
            {p}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Back-compat alias. */
export const GradeBadge = GradeChip;
