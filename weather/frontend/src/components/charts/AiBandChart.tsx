import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { PredictedHourly } from '@contract';
import { useElementWidth } from '../../hooks/useElementWidth';
import { datePart, formatHour, formatTemp, relativeDayLabel } from '../../lib/format';
import { linearScale } from '../../lib/range';

const H = 150;
const M = { top: 12, right: 10, bottom: 22, left: 30 };

/** AI temperature (--fg, 2 px) with the P10–P90 band (accent 14 %) and raw NWP dashed (--fg-3). */
export function AiBandChart({ hourly, today }: { hourly: PredictedHourly[]; today: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const [active, setActive] = useState<number | null>(null);
  const n = hourly.length;
  if (n < 2) return null;
  const lo = Math.floor(Math.min(...hourly.map((h) => Math.min(h.temperatureP10, h.temperatureNwp))));
  const hi = Math.ceil(Math.max(...hourly.map((h) => Math.max(h.temperatureP90, h.temperatureNwp))));
  const x = linearScale(0, n - 1, M.left, width - M.right);
  const y = linearScale(lo, hi, H - M.bottom, M.top);
  const line = (k: 'temperature' | 'temperatureNwp') => hourly.map((h, i) => `${x(i).toFixed(1)},${y(h[k]).toFixed(1)}`).join(' ');
  const band =
    hourly.map((h, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(h.temperatureP90).toFixed(1)}`).join('') +
    [...hourly]
      .reverse()
      .map((h, j) => `L${x(n - 1 - j).toFixed(1)},${y(h.temperatureP10).toFixed(1)}`)
      .join('') +
    'Z';
  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  const mid = hourly.map((h, i) => ({ i, h })).filter(({ h }) => h.time.slice(11, 13) === '00');

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    setActive(Math.min(n - 1, Math.max(0, Math.round(((px - M.left) / (width - M.left - M.right)) * (n - 1)))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    setActive((a) => Math.min(n - 1, Math.max(0, (a ?? -1) + (e.key === 'ArrowRight' ? 1 : -1))));
  };
  const sel = active != null ? hourly[active] : null;
  const flip = active != null && x(active) > width * 0.6;

  return (
    <div ref={ref} className="ai-chart">
      <svg
        width={width}
        height={H}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`AI temperature forecast for ${n} hours with 10th–90th percentile band and raw model input. Use arrow keys to inspect hours.`}
        onMouseMove={onMove}
        onMouseLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="chart-tick">
              {t}°
            </text>
          </g>
        ))}
        {mid.map(({ i, h }) => (
          <g key={h.time}>
            <line x1={x(i)} x2={x(i)} y1={M.top} y2={H - M.bottom} className="chart-daysep" />
            <text x={x(i) + 4} y={H - 6} className="chart-tick is-day">
              {relativeDayLabel(datePart(h.time), today)}
            </text>
          </g>
        ))}
        <path d={band} className="ai-chart__band" data-testid="ai-band" />
        <polyline points={line('temperatureNwp')} className="ai-chart__nwp" fill="none" data-testid="ai-nwp" />
        <polyline points={line('temperature')} className="ai-chart__ai" fill="none" data-testid="ai-line" />
        <circle cx={x(0)} cy={y(hourly[0].temperature)} r={4} className="chart-now" />
        {sel && active != null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={H - M.bottom} className="chart-cross" />
            <circle cx={x(active)} cy={y(sel.temperature)} r={4} className="chart-dot" />
          </g>
        )}
      </svg>
      {sel && active != null && (
        <div className="chart-tip" style={flip ? { right: width - x(active) + 10, top: 4 } : { left: x(active) + 10, top: 4 }} role="status">
          <strong>
            {relativeDayLabel(datePart(sel.time), today)} · {formatHour(sel.time)}
          </strong>
          <dl>
            <dt>AI estimate</dt>
            <dd>{formatTemp(sel.temperature, 1)}</dd>
            <dt>Range (P10–P90)</dt>
            <dd>
              {formatTemp(sel.temperatureP10, 1)} – {formatTemp(sel.temperatureP90, 1)}
            </dd>
            <dt>Raw model</dt>
            <dd>{formatTemp(sel.temperatureNwp, 1)}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
