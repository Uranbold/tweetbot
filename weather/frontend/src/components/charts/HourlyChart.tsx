import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { HourlyPoint } from '@contract';
import { WeatherIcon } from '../icons/WeatherIcon';
import { ArrowIcon, DropIcon } from '../icons/UiIcons';
import {
  datePart,
  formatHour,
  formatMonthDay,
  formatPrecip,
  formatTemp,
  formatWindSpeed,
  relativeDayLabel,
  roundTemp,
  weekdayShort,
  windArrowRotation,
  windDirectionLabel,
} from '../../lib/format';
import { linearScale } from '../../lib/range';

export type HourlyMetric = 'temperature' | 'precipitation' | 'humidity' | 'wind';

export const HOURLY_COL_WIDTH = 56;
const CHART_H = 92;
const PAD_TOP = 24;
const PAD_BOTTOM = 14;

interface HourlyChartProps {
  hourly: HourlyPoint[];
  metric: HourlyMetric;
  /** Location's "today" date (YYYY-MM-DD), for day-boundary labels. */
  today: string;
  colWidth?: number;
  /** A date selected elsewhere (weekly row): scrolled into view and highlighted. */
  highlightDate?: string | null;
}

/** Positions (column index) where a new local day starts, plus the first column. */
export function dayBoundaries(hourly: { time: string }[]): number[] {
  const idx: number[] = [];
  hourly.forEach((h, i) => {
    if (i === 0 || datePart(h.time) !== datePart(hourly[i - 1].time)) idx.push(i);
  });
  return idx;
}

export function dayLabel(date: string, today: string): string {
  const rel = relativeDayLabel(date, today);
  return rel === weekdayShort(date) ? `${rel} ${formatMonthDay(date)}` : rel;
}

/** Rect with only the top corners rounded, anchored to the baseline (UX §4.3 bars). */
export function topRoundedBar(x: number, base: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${base}V${base - h + rr}Q${x},${base - h} ${x + rr},${base - h}H${x + w - rr}Q${x + w},${base - h} ${x + w},${base - h + rr}V${base}Z`;
}

/**
 * Naver-style horizontally scrolling hourly strip (UX §4.3): time, icon, then the active metric as an
 * SVG line (temperature) or baseline bars (precipitation, humidity) or arrows (wind). Scroll-snaps by
 * hour, sticky day labels, accent "now" rule, and a crosshair tooltip on hover / ← → keys.
 */
export function HourlyChart({ hourly, metric, today, colWidth = HOURLY_COL_WIDTH, highlightDate }: HourlyChartProps) {
  const n = hourly.length;
  const width = n * colWidth;
  const cx = (i: number) => i * colWidth + colWidth / 2;
  const boundaries = dayBoundaries(hourly);
  const [active, setActive] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlightDate) return;
    const i = hourly.findIndex((h) => datePart(h.time) === highlightDate);
    const el = scrollerRef.current;
    if (i >= 0 && el) el.scrollTo?.({ left: Math.max(0, i * colWidth), behavior: 'smooth' });
  }, [highlightDate, hourly, colWidth]);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left) / colWidth);
    setActive(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next =
      e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : Math.min(n - 1, Math.max(0, (active ?? -1) + (e.key === 'ArrowRight' ? 1 : -1)));
    setActive(next);
    const el = e.currentTarget;
    const left = next * colWidth;
    if (left < el.scrollLeft || left + colWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = Math.max(0, left - el.clientWidth / 2);
  };

  const sel = active != null ? hourly[active] : null;
  const tipLeft = active != null ? cx(active) : 0;
  const flip = active != null && active > n - 4;

  return (
    <div
      ref={scrollerRef}
      className="scroll-x hourly-scroll"
      role="region"
      tabIndex={0}
      aria-label="Hourly forecast, scrollable. Use left and right arrow keys to inspect hours."
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <div
        className="hourly"
        style={{ width }}
        data-testid="hourly-chart"
        data-metric={metric}
        onMouseMove={onMove}
        onMouseLeave={() => setActive(null)}
      >
        <div className="hourly__days" aria-hidden="true">
          {boundaries.map((start, k) => {
            const end = boundaries[k + 1] ?? n;
            const date = datePart(hourly[start].time);
            return (
              <div
                key={start}
                className={`hourly__seg${highlightDate === date ? ' is-highlight' : ''}`}
                style={{ left: start * colWidth, width: (end - start) * colWidth }}
              >
                <span className="hourly__day">{dayLabel(date, today)}</span>
              </div>
            );
          })}
        </div>
        <span className="hourly__nowrule" style={{ left: cx(0) - 1 }} aria-hidden="true" />
        {active != null && <span className="hourly__cross" style={{ left: cx(active) - 0.5 }} aria-hidden="true" />}
        <ol className="hourly__cols" aria-label="Hourly forecast">
          {hourly.map((h, i) => {
            const isBoundary = i > 0 && boundaries.includes(i);
            return (
              <li
                key={h.time}
                className={`hourly__col${isBoundary ? ' is-day-start' : ''}${i === 0 ? ' is-now' : ''}${active === i ? ' is-active' : ''}`}
                style={{ width: colWidth }}
              >
                <span className="hourly__time">{i === 0 ? 'Now' : formatHour(h.time)}</span>
                <WeatherIcon condition={h.condition} size={30} />
                <span className="visually-hidden">
                  {`${roundTemp(h.temperature)}°, ${h.precipitationProbability}% chance of precipitation, humidity ${h.humidity}%, wind ${h.windSpeed} m/s`}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="hourly__plot" aria-hidden="true">
          {metric === 'temperature' && <TemperatureLine hourly={hourly} width={width} cx={cx} active={active} />}
          {metric === 'precipitation' && <PrecipBars hourly={hourly} width={width} cx={cx} colWidth={colWidth} />}
          {metric === 'humidity' && <HumidityBars hourly={hourly} width={width} cx={cx} colWidth={colWidth} />}
          {metric === 'wind' && <WindRow hourly={hourly} colWidth={colWidth} />}
        </div>
        {(metric === 'temperature' || metric === 'precipitation') && (
          <div className="hourly__row" aria-hidden="true">
            {hourly.map((h) => (
              <span key={h.time} className={`hourly__pop${h.precipitationProbability >= 50 ? ' is-wet' : ''}`} style={{ width: colWidth }}>
                <DropIcon size={10} />
                {h.precipitationProbability}%
              </span>
            ))}
          </div>
        )}
        {sel && (
          <div className="chart-tip hourly__tip" style={flip ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }} aria-live="polite">
            <strong>
              {dayLabel(datePart(sel.time), today)} · {formatHour(sel.time)}
            </strong>
            <span className="chart-tip__sub">{sel.condition.label}</span>
            <dl>
              <dt>Temp</dt>
              <dd>{formatTemp(sel.temperature)}</dd>
              <dt>Feels</dt>
              <dd>{formatTemp(sel.feelsLike)}</dd>
              <dt>Rain</dt>
              <dd>
                {sel.precipitationProbability}% · {formatPrecip(sel.precipitation)} mm
              </dd>
              <dt>Humidity</dt>
              <dd>{sel.humidity}%</dd>
              <dt>Wind</dt>
              <dd>
                {windDirectionLabel(sel.windDirection)} {formatWindSpeed(sel.windSpeed)}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function TemperatureLine({ hourly, width, cx, active }: { hourly: HourlyPoint[]; width: number; cx: (i: number) => number; active: number | null }) {
  const temps = hourly.map((h) => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const y = linearScale(min, max, CHART_H - PAD_BOTTOM, PAD_TOP);
  const pts = hourly.map((h, i) => `${cx(i)},${y(h.temperature).toFixed(1)}`);
  const area = `M${cx(0)},${CHART_H} L${pts.join(' L')} L${cx(hourly.length - 1)},${CHART_H} Z`;
  return (
    <svg className="hourly__svg" width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} role="presentation">
      <path d={area} className="hourly__area" />
      <polyline points={pts.join(' ')} className="hourly__line" fill="none" />
      {hourly.map((h, i) => {
        const t = roundTemp(h.temperature);
        const isMax = h.temperature === max;
        const isMin = h.temperature === min;
        return (
          <g key={h.time}>
            <circle
              data-testid="hourly-point"
              cx={cx(i)}
              cy={y(h.temperature)}
              r={i === 0 || i === active ? 4.5 : 3}
              className={`hourly__dot${i === 0 ? ' is-now' : ''}${i === active ? ' is-active' : ''}`}
            />
            <text x={cx(i)} y={y(h.temperature) - 9} textAnchor="middle" className={`hourly__label${isMax ? ' is-max' : ''}${isMin ? ' is-min' : ''}`}>
              {t}°
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PrecipBars({ hourly, width, cx, colWidth }: { hourly: HourlyPoint[]; width: number; cx: (i: number) => number; colWidth: number }) {
  const max = Math.max(2, ...hourly.map((h) => h.precipitation));
  const h0 = CHART_H - PAD_BOTTOM;
  const scale = linearScale(0, max, 0, h0 - PAD_TOP);
  const bw = Math.min(18, colWidth - 20);
  return (
    <svg className="hourly__svg" width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} role="presentation">
      <line x1={0} x2={width} y1={h0} y2={h0} className="chart-baseline" />
      {hourly.map((h, i) => {
        const bh = h.precipitation > 0 ? Math.max(3, scale(h.precipitation)) : 0;
        return (
          <g key={h.time}>
            {bh > 0 && <path data-testid="hourly-bar" d={topRoundedBar(cx(i) - bw / 2, h0, bw, bh)} className="hourly__bar hourly__bar--rain" />}
            <text x={cx(i)} y={h0 - bh - 6} textAnchor="middle" className="hourly__label">
              {formatPrecip(h.precipitation)}
              {h.precipitation >= 0.05 ? 'mm' : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HumidityBars({ hourly, width, cx, colWidth }: { hourly: HourlyPoint[]; width: number; cx: (i: number) => number; colWidth: number }) {
  const h0 = CHART_H - PAD_BOTTOM;
  const scale = linearScale(0, 100, 0, h0 - PAD_TOP);
  const bw = Math.min(18, colWidth - 20);
  return (
    <svg className="hourly__svg" width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} role="presentation">
      <line x1={0} x2={width} y1={h0} y2={h0} className="chart-baseline" />
      {hourly.map((h, i) => {
        const bh = Math.max(2, scale(h.humidity));
        return (
          <g key={h.time}>
            <path data-testid="hourly-bar" d={topRoundedBar(cx(i) - bw / 2, h0, bw, bh)} className="hourly__bar hourly__bar--humidity" />
            <text x={cx(i)} y={h0 - bh - 6} textAnchor="middle" className="hourly__label">
              {h.humidity}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function WindRow({ hourly, colWidth }: { hourly: HourlyPoint[]; colWidth: number }) {
  return (
    <div className="hourly__wind" style={{ height: CHART_H }}>
      {hourly.map((h) => (
        <span key={h.time} className={`hourly__windcell${h.windSpeed >= 9 ? ' is-strong' : ''}`} style={{ width: colWidth }}>
          <ArrowIcon size={20} rotation={windArrowRotation(h.windDirection)} label={`From ${windDirectionLabel(h.windDirection)}`} />
          <span className="hourly__windspeed">{roundTemp(h.windSpeed, 1).toFixed(1)}</span>
          <span className="hourly__windunit">{windDirectionLabel(h.windDirection)}</span>
        </span>
      ))}
    </div>
  );
}

/** Table view of the same data (UX §5: charts have a table alternative). */
export function HourlyTable({ hourly, today }: { hourly: HourlyPoint[]; today: string }) {
  return (
    <div className="scroll-x table-wrap" tabIndex={0} role="region" aria-label="Hourly forecast table">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Condition</th>
            <th scope="col">Temp</th>
            <th scope="col">Rain</th>
            <th scope="col">Humidity</th>
            <th scope="col">Wind</th>
          </tr>
        </thead>
        <tbody>
          {hourly.map((h, i) => (
            <tr key={h.time}>
              <th scope="row">
                {i === 0 ? 'Now' : `${relativeDayLabel(datePart(h.time), today) === 'Today' ? '' : `${weekdayShort(h.time)} `}${formatHour(h.time)}`}
              </th>
              <td>{h.condition.label}</td>
              <td>{formatTemp(h.temperature, 0, '°C')}</td>
              <td>
                {h.precipitationProbability}% · {formatPrecip(h.precipitation)} mm
              </td>
              <td>{h.humidity}%</td>
              <td>
                {windDirectionLabel(h.windDirection)} {formatWindSpeed(h.windSpeed)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
