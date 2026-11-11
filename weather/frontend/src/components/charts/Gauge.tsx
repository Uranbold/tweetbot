import type { AirGrade, AirQualityReport } from '@contract';
import { AIR_GRADES, AIR_GRADE_COLORS, gradeColor, gradeLabel } from '../../lib/air';
import { GradeFace } from '../icons/GradeFace';

type Band = AirQualityReport['scale']['pm10'][number];

/**
 * Maps a value onto 0..1 where each grade band occupies an equal quarter of the dial
 * (piecewise-linear), the way Naver's dust dial reads. The open top band spans min..min*1.5.
 */
export function gaugePosition(value: number, scale: Band[]): number {
  if (scale.length === 0) return 0;
  const q = 1 / scale.length;
  for (let i = 0; i < scale.length; i++) {
    const b = scale[i];
    const lo = b.min;
    const hi = b.max ?? b.min * 1.5;
    const next = scale[i + 1];
    if (!next || value < next.min) {
      const frac = hi > lo ? (Math.min(value, hi) - lo) / (hi - lo) : 1;
      return Math.min(1, Math.max(0, i * q + Math.max(0, frac) * q));
    }
  }
  return 1;
}

const polar = (cx: number, cy: number, r: number, t: number) => {
  const a = Math.PI * (1 - t);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
};

function arcPath(cx: number, cy: number, r: number, t0: number, t1: number) {
  const [x0, y0] = polar(cx, cy, r, t0);
  const [x1, y1] = polar(cx, cy, r, t1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

export function Gauge({ label, value, grade, scale, unit = 'µg/m³', size = 180 }: { label: string; value: number; grade: AirGrade; scale: Band[]; unit?: string; size?: number }) {
  const cx = size / 2;
  const r = size / 2 - 14;
  const cy = r + 14;
  const t = gaugePosition(value, scale);
  const [nx, ny] = polar(cx, cy, r, t);
  const gap = 1 / (Math.PI * r); // 2 px gap between segments (1 px each side)
  return (
    <figure className="gauge" style={{ ['--grade' as string]: gradeColor(grade) }}>
      <svg viewBox={`0 0 ${size} ${cy + 8}`} width="100%" style={{ maxWidth: size }} role="img" aria-label={`${label}: ${value} ${unit}, ${gradeLabel(grade)}`}>
        {AIR_GRADES.map((g, i) => (
          <path key={g} d={arcPath(cx, cy, r, i / 4 + (i ? gap : 0), (i + 1) / 4 - (i < 3 ? gap : 0))} style={{ stroke: AIR_GRADE_COLORS[g] }} className="gauge__band" fill="none" />
        ))}
        <circle cx={nx} cy={ny} r={9} className="gauge__knob" />
        <text x={cx} y={cy - 22} textAnchor="middle" className="gauge__value">
          {Math.round(value)}
        </text>
        <text x={cx} y={cy - 4} textAnchor="middle" className="gauge__unit">
          {unit}
        </text>
      </svg>
      <figcaption>
        <span className="gauge__label">{label}</span>
        <span className="gauge__grade">
          <GradeFace grade={grade} size={20} />
          {gradeLabel(grade)}
        </span>
      </figcaption>
    </figure>
  );
}
