import type { AirGrade } from '@contract';
import { gradeColor, gradeLabel } from '../../lib/air';

/**
 * Naver-style dust face glyph (UX §3.3): smile · neutral · mask · frown, drawn as inline SVG so it
 * renders identically everywhere. The grade label is always printed next to it; pass `label` to
 * give the face its own accessible name when used alone.
 */
export function GradeFace({ grade, size = 16, label }: { grade: AirGrade | null | undefined; size?: number; label?: string }) {
  const fill = gradeColor(grade);
  const ink = 'var(--face-ink)';
  return (
    <svg
      className="grade-face"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-face={grade ?? 'none'}
    >
      {label && <title>{label}</title>}
      <circle cx="12" cy="12" r="11" fill={grade ? fill : 'none'} stroke={grade ? 'none' : 'var(--fg-3)'} strokeWidth={1.5} />
      {grade && (
        <g stroke={ink} strokeWidth={1.75} strokeLinecap="round" fill="none">
          {grade === 'very-bad' ? (
            <>
              <path d="M7 8.2l2.6 1.4M17 8.2l-2.6 1.4" />
              <path d="M7.5 17.2c1.2-1.9 2.7-2.8 4.5-2.8s3.3.9 4.5 2.8" />
            </>
          ) : (
            <>
              <circle cx="8.5" cy="9.5" r="0.6" fill={ink} />
              <circle cx="15.5" cy="9.5" r="0.6" fill={ink} />
            </>
          )}
          {grade === 'good' && <path d="M7.5 14c1.2 2 2.7 3 4.5 3s3.3-1 4.5-3" />}
          {grade === 'moderate' && <path d="M8 15.5h8" />}
          {grade === 'bad' && (
            <>
              <rect x="6.5" y="12.5" width="11" height="5.5" rx="2" fill={ink} stroke="none" />
              <path d="M6.5 13.5L3.5 12M17.5 13.5l3-1.5" />
            </>
          )}
        </g>
      )}
      {!grade && <path d="M8.5 12h7" stroke="var(--fg-3)" strokeWidth={1.75} strokeLinecap="round" />}
      <desc>{gradeLabel(grade)}</desc>
    </svg>
  );
}
