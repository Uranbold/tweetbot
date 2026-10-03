import { useState } from 'react';
import type { AirHourlyPoint } from '@contract';
import { gradeColor, gradeLabel } from '../../lib/air';
import { datePart, formatHour, formatMonthDay, relativeDayLabel, weekdayShort } from '../../lib/format';
import { dayBoundaries, topRoundedBar } from './HourlyChart';

const BAR = 12;
const GAP = 3;
const H = 140;
const TOP = 18;

/** 72h bar chart; each bar coloured by its grade. Hover/focus a bar to read its value. */
export function AirHourlyChart({ hourly, pollutant, today }: { hourly: AirHourlyPoint[]; pollutant: 'pm10' | 'pm25'; today: string }) {
  const [active, setActive] = useState<number | null>(null);
  const step = BAR + GAP;
  const width = hourly.length * step;
  const max = Math.max(1, ...hourly.map((p) => p[pollutant]));
  const base = H - 20;
  const scale = (v: number) => (v / max) * (base - TOP);
  const bounds = dayBoundaries(hourly);
  const sel = active != null ? hourly[active] : null;
  const name = pollutant === 'pm10' ? 'PM10' : 'PM2.5';
  return (
    <div className="air-chart">
      <p className="air-chart__readout" aria-live="polite">
        {sel ? (
          <>
            <strong>
              {relativeDayLabel(datePart(sel.time), today)} {formatHour(sel.time)}
            </strong>{' '}
            · {name} {sel[pollutant]} µg/m³ · {gradeLabel(pollutant === 'pm10' ? sel.pm10Grade : sel.pm25Grade)}
          </>
        ) : (
          <span className="muted">Hover or focus a bar for details</span>
        )}
      </p>
      <div
        className="scroll-x"
        tabIndex={0}
        role="region"
        aria-label={`${name} next ${hourly.length} hours. Use arrow keys to step through hours.`}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          e.preventDefault();
          const next = Math.min(hourly.length - 1, Math.max(0, (active ?? -1) + (e.key === 'ArrowRight' ? 1 : -1)));
          setActive(next);
          e.currentTarget.scrollLeft = Math.max(0, next * step - e.currentTarget.clientWidth / 2);
        }}
        onBlur={() => setActive(null)}
      >
        <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="air-chart__svg" onMouseLeave={() => setActive(null)}>
          <line x1={0} x2={width} y1={base} y2={base} className="chart-baseline" />
          {bounds.map((i) => {
            const d = datePart(hourly[i].time);
            const rel = relativeDayLabel(d, today);
            return (
              <g key={i}>
                {i > 0 && <line x1={i * step - GAP / 2} x2={i * step - GAP / 2} y1={0} y2={base} className="chart-daysep" />}
                <text x={i * step + 2} y={12} className="chart-tick is-day">
                  {rel === weekdayShort(d) ? `${rel} ${formatMonthDay(d)}` : rel}
                </text>
              </g>
            );
          })}
          {hourly.map((p, i) => {
            const v = p[pollutant];
            const g = pollutant === 'pm10' ? p.pm10Grade : p.pm25Grade;
            const bh = Math.max(2, scale(v));
            return (
              <g key={p.time} onMouseEnter={() => setActive(i)} className={active === i ? 'is-active' : undefined}>
                <rect x={i * step} y={TOP} width={BAR + GAP} height={base - TOP} fill="transparent" />
                <path data-testid="air-bar" data-grade={g} d={topRoundedBar(i * step, base, BAR, bh)} style={{ fill: gradeColor(g) }} className="air-chart__bar" />
                {i % 6 === 0 && (
                  <text x={i === 0 ? 0 : i * step + BAR / 2} y={H - 4} textAnchor={i === 0 ? 'start' : 'middle'} className="chart-tick">
                    {formatHour(p.time).replace(' ', '')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/** Table view of the same 72 h series. */
export function AirHourlyTable({ hourly, today }: { hourly: AirHourlyPoint[]; today: string }) {
  return (
    <div className="scroll-x table-wrap" tabIndex={0} role="region" aria-label="Hourly air quality table">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">PM10 µg/m³</th>
            <th scope="col">PM2.5 µg/m³</th>
            <th scope="col">O₃ µg/m³</th>
          </tr>
        </thead>
        <tbody>
          {hourly.map((p) => (
            <tr key={p.time}>
              <th scope="row">
                {relativeDayLabel(datePart(p.time), today)} {formatHour(p.time)}
              </th>
              <td>
                {p.pm10} · {gradeLabel(p.pm10Grade)}
              </td>
              <td>
                {p.pm25} · {gradeLabel(p.pm25Grade)}
              </td>
              <td>{p.o3}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
