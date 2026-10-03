import { formatClock, sunProgress } from '../../lib/format';

/** Semicircular sun path from sunrise (left) to sunset (right), with the sun at the current time. */
export function SunArc({ now, sunrise, sunset, width = 280 }: { now: string; sunrise: string; sunset: string; width?: number }) {
  const r = width / 2 - 20;
  const cx = width / 2;
  const cy = r + 16;
  const height = cy + 26;
  const p = sunProgress(now, sunrise, sunset);
  const isUp = p >= 0 && p <= 1;
  const t = Math.min(1, Math.max(0, p));
  const angle = Math.PI * (1 - t); // π at sunrise → 0 at sunset
  const sx = cx + r * Math.cos(angle);
  const sy = cy - r * Math.sin(angle);
  const arc = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`;
  const done = `M${cx - r},${cy} A${r},${r} 0 0 1 ${sx.toFixed(2)},${sy.toFixed(2)}`;
  const label = isUp
    ? `Sun is up: ${Math.round(t * 100)}% of daylight elapsed`
    : p < 0
      ? 'Before sunrise'
      : 'After sunset';
  return (
    <svg className="sun-arc" viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }} role="img" aria-label={label} data-progress={p.toFixed(3)}>
      <line x1={8} x2={width - 8} y1={cy} y2={cy} className="sun-arc__horizon" />
      <path d={arc} className="sun-arc__track" fill="none" />
      {isUp && <path d={`${done} L${sx.toFixed(2)},${cy} L${cx - r},${cy}Z`} className="sun-arc__fill" />}
      {isUp && <path d={done} className="sun-arc__done" fill="none" />}
      {isUp ? (
        <g>
          <circle cx={sx} cy={sy} r={13} className="sun-arc__glow" />
          <circle cx={sx} cy={sy} r={8} className="sun-arc__sun" data-testid="sun" />
        </g>
      ) : (
        <circle cx={p < 0 ? cx - r : cx + r} cy={cy} r={6} className="sun-arc__sun is-down" data-testid="sun" />
      )}
      <text x={cx - r} y={cy + 20} textAnchor="middle" className="sun-arc__text">
        {formatClock(sunrise)}
      </text>
      <text x={cx + r} y={cy + 20} textAnchor="middle" className="sun-arc__text">
        {formatClock(sunset)}
      </text>
    </svg>
  );
}
