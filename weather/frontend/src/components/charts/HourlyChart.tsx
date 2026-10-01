import type { HourlyPoint } from '@contract';
import { WeatherIcon } from '../icons/WeatherIcon';
import { ArrowIcon, DropIcon } from '../icons/UiIcons';
import { datePart, formatHour, formatPrecip, relativeDayLabel, roundTemp, windArrowRotation, windDirectionLabel, weekdayShort, formatMonthDay } from '../../lib/format';
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
}

/** Positions (column index) where a new local day starts, plus the first column. */
export function dayBoundaries(hourly: { time: string }[]): number[] {
  const idx: number[] = [];
  hourly.forEach((h, i) => {
    if (i === 0 || datePart(h.time) !== datePart(hourly[i - 1].time)) idx.push(i);
  });
  return idx;
}

/**
 * Naver-style horizontally scrolling hourly strip: time, icon, then one metric drawn as an SVG
 * line (temperature) or bars (precipitation, humidity), or arrows (wind). Every column is labelled.
 */
export function HourlyChart({ hourly, metric, today, colWidth = HOURLY_COL_WIDTH }: HourlyChartProps) {
  const n = hourly.length;
  const width = n * colWidth;
  const cx = (i: number) => i * colWidth + colWidth / 2;
  const boundaries = dayBoundaries(hourly);

  return (
    <div className="hourly" style={{ width }} data-testid="hourly-chart">
      <div className="hourly__days" aria-hidden="true">
        {boundaries.map((i) => {
          const date = datePart(hourly[i].time);
          const rel = relativeDayLabel(date, today);
          const label = rel === weekdayShort(date) ? `${rel} ${formatMonthDay(date)}` : rel;
          return (
            <span key={i} className="hourly__day" style={{ left: i * colWidth }}>
              {label}
            </span>
          );
        })}
      </div>
      <ol className="hourly__cols" aria-label="Hourly forecast">
        {hourly.map((h, i) => {
          const isBoundary = i > 0 && boundaries.includes(i);
          return (
            <li key={h.time} className={`hourly__col${isBoundary ? ' is-day-start' : ''}`} style={{ width: colWidth }}>
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
        {metric === 'temperature' && <TemperatureLine hourly={hourly} width={width} cx={cx} />}
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
    </div>
  );
}

function TemperatureLine({ hourly, width, cx }: { hourly: HourlyPoint[]; width: number; cx: (i: number) => number }) {
  const temps = hourly.map((h) => h.temperature);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const y = linearScale(min, max, CHART_H - PAD_BOTTOM, PAD_TOP);
  const points = hourly.map((h, i) => `${cx(i)},${y(h.temperature).toFixed(1)}`).join(' ');
  const area = `M${cx(0)},${CHART_H} L${points.split(' ').join(' L')} L${cx(hourly.length - 1)},${CHART_H} Z`;
  return (
    <svg className="hourly__svg" width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`} role="presentation">
      <path d={area} className="hourly__area" />
      <polyline points={points} className="hourly__line" fill="none" />
      {hourly.map((h, i) => {
        const t = roundTemp(h.temperature);
        const isMax = h.temperature === max;
        const isMin = h.temperature === min;
        return (
          <g key={h.time}>
            <circle data-testid="hourly-point" cx={cx(i)} cy={y(h.temperature)} r={i === 0 ? 4.5 : 3.5} className={`hourly__dot${i === 0 ? ' is-now' : ''}`} />
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
      <line x1={0} x2={width} y1={h0} y2={h0} className="hourly__baseline" />
      {hourly.map((h, i) => {
        const bh = h.precipitation > 0 ? Math.max(3, scale(h.precipitation)) : 0;
        return (
          <g key={h.time}>
            {bh > 0 && <rect data-testid="hourly-bar" x={cx(i) - bw / 2} y={h0 - bh} width={bw} height={bh} rx={4} className="hourly__bar hourly__bar--rain" />}
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
      <line x1={0} x2={width} y1={h0} y2={h0} className="hourly__baseline" />
      {hourly.map((h, i) => {
        const bh = Math.max(2, scale(h.humidity));
        return (
          <g key={h.time}>
            <rect data-testid="hourly-bar" x={cx(i) - bw / 2} y={h0 - bh} width={bw} height={bh} rx={4} className="hourly__bar hourly__bar--humidity" />
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
