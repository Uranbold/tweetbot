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
const LABEL_W = 118;

/** Spreads end-label y positions so they never overlap (min gap px), keeping order. */
export function spreadLabels(ys: number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const overflow = order.length ? order[order.length - 1].y - hi : 0;
  if (overflow > 0) for (const o of order) o.y -= overflow;
  for (let k = 0; k < order.length; k++) order[k].y = Math.max(order[k].y, lo + k * gap);
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

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
  const direct = series.length <= 7 && width >= 360;
  const right = M.right + (direct ? LABEL_W : 0);
  const x = linearScale(0, n - 1, M.left, width - right);
  const y = linearScale(yMin, yMax, H - M.bottom, M.top);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - M.left) / (width - M.left - right)) * (n - 1));
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
            <line x1={M.left} x2={width - right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">
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
              {h === 0 && <line x1={x(i)} x2={x(i)} y1={M.top} y2={H - M.bottom} className="chart-daysep" />}
              <text x={x(i)} y={H - 8} textAnchor="middle" className={`chart-tick${h === 0 ? ' is-day' : ''}`}>
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
            style={{ stroke: s.color }}
            className="mlc__line"
          />
        ))}
        {direct &&
          (() => {
            const ends = series.map((s) => y(s.points[n - 1].value));
            const ly = spreadLabels(ends, 13, M.top + 4, H - M.bottom);
            return series.map((s, k) => (
              <g key={`lbl-${s.id}`} data-testid={`label-${s.id}`}>
                <path d={`M${x(n - 1) + 3},${ends[k]} L${x(n - 1) + 10},${ly[k]} H${x(n - 1) + 16}`} style={{ stroke: s.color }} className="mlc__leader" fill="none" />
                <text x={x(n - 1) + 20} y={ly[k] + 4} className="mlc__endlabel">
                  {s.label} {roundTemp(s.points[n - 1].value)}
                  {unit}
                </text>
              </g>
            ));
          })()}
        {active != null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={H - M.bottom} className="chart-cross" />
            {series.map((s) => (
              <circle key={s.id} cx={x(active)} cy={y(s.points[active].value)} r={4} style={{ fill: s.color }} className="chart-dot" />
            ))}
          </g>
        )}
      </svg>
      {active != null && (
        <div className="chart-tip mlc__tip" style={tipOnLeft ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }} role="status">
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
