import type { AlertType } from '@contract';

/** Small line glyphs per hazard (UX §4.6 "hazard glyph + name"). Decorative: the name is printed. */
export function HazardGlyph({ hazard, size = 18 }: { hazard: AlertType; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let body;
  switch (hazard) {
    case 'strong-wind':
    case 'typhoon':
      body = <path {...p} d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />;
      break;
    case 'cold-wave':
    case 'heavy-snow':
      body = <path {...p} d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" />;
      break;
    case 'heat-wave':
      body = (
        <>
          <path {...p} d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z" />
          <path {...p} d="M12 10v6" />
        </>
      );
      break;
    case 'heavy-rain':
      body = <path {...p} d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z" />;
      break;
    case 'fine-dust':
      body = (
        <>
          <circle cx="7" cy="8" r="1.5" fill="currentColor" />
          <circle cx="15" cy="6" r="1.2" fill="currentColor" />
          <circle cx="11" cy="13" r="1.8" fill="currentColor" />
          <circle cx="18" cy="14" r="1.4" fill="currentColor" />
          <circle cx="6" cy="17" r="1.2" fill="currentColor" />
          <circle cx="14" cy="19" r="1.2" fill="currentColor" />
        </>
      );
      break;
    case 'dry':
    default:
      body = <path {...p} d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11zM5 5l14 14" />;
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className="hazard-glyph">
      {body}
    </svg>
  );
}
