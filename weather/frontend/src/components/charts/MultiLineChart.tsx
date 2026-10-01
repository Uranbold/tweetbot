import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { datePart, formatHour, relativeDayLabel, roundTemp } from '../../lib/format';
import { linearScale } from '../../lib/range';

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  points: { time: string; value: number }[];
}

const H = 240;
const M = { top: 16, right: 16, bottom: 28, left: 34 };

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Multi-series line chart with a hover/keyboard crosshair and tooltip. Colour follows the series id. */
export function MultiLineChart({ series, today, unit = '°' }: { series: LineSeries[]; today: string; unit?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);
  const times = series[0]?.points.map((p) => p.time) ?? [];
  const n = times.length;
  if (n === 0) return null;

  const values = series.flatMap((s) => s.points.map((p) => p.value));
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = Math.min(ticks[0], Math.min(...values));
  const yMax = Math.max(ticks[ticks.length - 1], Math.max(...values));
  const x = linearScale(0, n - 1, M.left, width - M.right);
  const y = linearScale(yMin, yMax, H - M.bottom, M.top);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - M.left) / (width - M.left - M.right)) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    setActive((a) => Math.min(n - 1, Math.max(0, (a ?? -1) + (e.key === 'ArrowRight' ? 1 : -1))));
  };

  const tipLeft = active != null ? x(active) : 0;
  const tipOnLeft = active != null && tipLeft > width * 0.6;

  return (
    <div className="mlc" ref={ref}>
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        className="mlc__svg"
        role="img"
        tabIndex={0}
        aria-label={`Hourly temperature by model for ${series.length} models. Use arrow keys to inspect hours.`}
        onMouseMove={onMove}
        onMouseLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="mlc__grid" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="mlc__tick">
              {t}
              {unit}
            </text>
          </g>
        ))}
        {times.map((t, i) => {
          const h = Number(t.slice(11, 13));
          if (h % 6 !== 0) return null;
          const rel = relativeDayLabel(datePart(t), today);
          return (
            <g key={t}>
              {h === 0 && <line x1={x(i)} x2={x(i)} y1={M.top} y2={H - M.bottom} className="mlc__daysep" />}
              <text x={x(i)} y={H - 8} textAnchor="middle" className={`mlc__tick${h === 0 ? ' is-day' : ''}`}>
                {h === 0 ? rel : formatHour(t).replace(' ', '')}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <polyline
            key={s.id}
            data-testid={`line-${s.id}`}
            points={s.points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={s.color}
            className="mlc__line"
          />
        ))}
        {active != null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={H - M.bottom} className="mlc__cross" />
            {series.map((s) => (
              <circle key={s.id} cx={x(active)} cy={y(s.points[active].value)} r={4} fill={s.color} className="mlc__dot" />
            ))}
          </g>
        )}
      </svg>
      {active != null && (
        <div className="mlc__tip" style={tipOnLeft ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }} role="status">
          <strong>
            {relativeDayLabel(datePart(times[active]), today)} {formatHour(times[active])}
          </strong>
          <ul>
            {[...series]
              .sort((a, b) => b.points[active].value - a.points[active].value)
              .map((s) => (
                <li key={s.id}>
                  <span className="swatch" style={{ background: s.color }} aria-hidden="true" />
                  <span className="mlc__tipname">{s.label}</span>
                  <span className="mlc__tipval">
                    {roundTemp(s.points[active].value, 1)}
                    {unit}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
