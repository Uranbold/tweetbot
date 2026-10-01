import { useState } from 'react';
import type { DailyPoint } from '@contract';
import { Card } from '../common/Card';
import { WeatherIcon } from '../icons/WeatherIcon';
import { formatMonthDay, formatTemp, relativeDayLabel, weekdayShort } from '../../lib/format';
import { rangeBarGeometry, weekExtent } from '../../lib/range';

interface RowProps {
  day: DailyPoint;
  today: string;
  weekMin: number;
  weekMax: number;
  /** Current temperature, drawn as a dot on today's bar. */
  currentTemp?: number;
  selected?: boolean;
  onSelect?: (date: string) => void;
}

export function WeeklyRow({ day, today, weekMin, weekMax, currentTemp, selected, onSelect }: RowProps) {
  const { left, width } = rangeBarGeometry(day.temperatureMin, day.temperatureMax, weekMin, weekMax);
  const label = relativeDayLabel(day.date, today);
  const wd = weekdayShort(day.date);
  const dayClass = wd === 'Sat' ? ' is-sat' : wd === 'Sun' ? ' is-sun' : '';
  const nowPos = currentTemp != null && weekMax > weekMin ? Math.min(100, Math.max(0, ((currentTemp - weekMin) / (weekMax - weekMin)) * 100)) : null;
  const content = (
    <>
      <span className={`week-row__day${dayClass}`}>
        <strong>{label}</strong>
        <span className="week-row__date">{formatMonthDay(day.date)}</span>
      </span>
      <span className="week-row__half" title="Morning">
        <span className="visually-hidden">Morning:</span>
        <WeatherIcon condition={day.am.condition} size={28} />
        <span className={`week-row__pop${day.am.precipitationProbability >= 50 ? ' is-wet' : ''}`}>{day.am.precipitationProbability}%</span>
      </span>
      <span className="week-row__half" title="Afternoon">
        <span className="visually-hidden">Afternoon:</span>
        <WeatherIcon condition={day.pm.condition} size={28} />
        <span className={`week-row__pop${day.pm.precipitationProbability >= 50 ? ' is-wet' : ''}`}>{day.pm.precipitationProbability}%</span>
      </span>
      <span className="week-row__temps">
        <span className="t-min" aria-label={`Low ${formatTemp(day.temperatureMin)}`}>
          {formatTemp(day.temperatureMin)}
        </span>
        <span className="range" aria-hidden="true">
          <span className="range__bar" data-testid="range-bar" style={{ left: `${left}%`, width: `${width}%` }} />
          {nowPos != null && <span className="range__now" data-testid="range-now" style={{ left: `${nowPos}%` }} />}
        </span>
        <span className="t-max" aria-label={`High ${formatTemp(day.temperatureMax)}`}>
          {formatTemp(day.temperatureMax)}
        </span>
      </span>
    </>
  );
  return (
    <li className={`week-row${selected ? ' is-selected' : ''}`} data-testid="week-row">
      {onSelect ? (
        <button type="button" className="week-row__btn" aria-pressed={selected} onClick={() => onSelect(day.date)}>
          {content}
        </button>
      ) : (
        <div className="week-row__btn">{content}</div>
      )}
    </li>
  );
}

/** UX §4.4: 7 rows visible, "Show 10 days" reveals the rest (Miller's law). */
export function WeeklyCard({
  daily,
  today,
  currentTemp,
  selectedDate,
  onSelectDate,
  initialRows = 7,
}: {
  daily: DailyPoint[];
  today: string;
  currentTemp?: number;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  initialRows?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { min, max } = weekExtent(daily);
  const rows = expanded ? daily : daily.slice(0, initialRows);
  return (
    <Card title={`${daily.length}-day forecast`} className="weekly-card">
      <div className="week-head" aria-hidden="true">
        <span />
        <span>AM</span>
        <span>PM</span>
        <span>Low · High</span>
      </div>
      <ol className="week-list" id="week-list">
        {rows.map((d) => (
          <WeeklyRow
            key={d.date}
            day={d}
            today={today}
            weekMin={min}
            weekMax={max}
            currentTemp={d.date === today ? currentTemp : undefined}
            selected={selectedDate === d.date}
            onSelect={onSelectDate}
          />
        ))}
      </ol>
      {daily.length > initialRows && (
        <button type="button" className="btn btn--quiet week-more" aria-expanded={expanded} aria-controls="week-list" onClick={() => setExpanded((e) => !e)}>
          {expanded ? `Show ${initialRows} days` : `Show ${daily.length} days`}
        </button>
      )}
    </Card>
  );
}
