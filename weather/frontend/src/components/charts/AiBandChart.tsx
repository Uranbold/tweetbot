import type { PredictedHourly } from '@contract';
import { useElementWidth } from '../../hooks/useElementWidth';
import { datePart, relativeDayLabel } from '../../lib/format';
import { linearScale } from '../../lib/range';

const H = 150;
const M = { top: 12, right: 10, bottom: 22, left: 30 };

/** AI temperature (solid) with the P10–P90 band shaded and the raw NWP input dashed. */
export function AiBandChart({ hourly, today }: { hourly: PredictedHourly[]; today: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
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
  return (
    <div ref={ref} className="ai-chart">
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`AI temperature forecast for ${n} hours with 10th–90th percentile band and raw model input`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="mlc__grid" />
            <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="mlc__tick">
              {t}°
            </text>
          </g>
        ))}
        {mid.map(({ i, h }) => (
          <g key={h.time}>
            <line x1={x(i)} x2={x(i)} y1={M.top} y2={H - M.bottom} className="mlc__daysep" />
            <text x={x(i) + 4} y={H - 6} className="mlc__tick is-day">
              {relativeDayLabel(datePart(h.time), today)}
            </text>
          </g>
        ))}
        <path d={band} className="ai-chart__band" data-testid="ai-band" />
        <polyline points={line('temperatureNwp')} className="ai-chart__nwp" fill="none" data-testid="ai-nwp" />
        <polyline points={line('temperature')} className="ai-chart__ai" fill="none" data-testid="ai-line" />
      </svg>
    </div>
  );
}
