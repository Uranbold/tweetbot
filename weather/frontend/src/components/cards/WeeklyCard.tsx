import type { DailyPoint } from '@contract';
import { Card } from '../common/Card';
import { WeatherIcon } from '../icons/WeatherIcon';
import { formatMonthDay, formatTemp, relativeDayLabel, weekdayShort } from '../../lib/format';
import { rangeBarGeometry, weekExtent } from '../../lib/range';

export function WeeklyRow({ day, today, weekMin, weekMax }: { day: DailyPoint; today: string; weekMin: number; weekMax: number }) {
  const { left, width } = rangeBarGeometry(day.temperatureMin, day.temperatureMax, weekMin, weekMax);
  const label = relativeDayLabel(day.date, today);
  const wd = weekdayShort(day.date);
  const dayClass = wd === 'Sat' ? ' is-sat' : wd === 'Sun' ? ' is-sun' : '';
  return (
    <li className="week-row" data-testid="week-row">
      <span className={`week-row__day${dayClass}`}>
        <strong>{label}</strong>
        <span className="week-row__date">{formatMonthDay(day.date)}</span>
      </span>
      <span className="week-row__half" title="Morning">
        <span className="visually-hidden">Morning:</span>
        <WeatherIcon condition={day.am.condition} size={30} />
        <span className={`week-row__pop${day.am.precipitationProbability >= 50 ? ' is-wet' : ''}`}>{day.am.precipitationProbability}%</span>
      </span>
      <span className="week-row__half" title="Afternoon">
        <span className="visually-hidden">Afternoon:</span>
        <WeatherIcon condition={day.pm.condition} size={30} />
        <span className={`week-row__pop${day.pm.precipitationProbability >= 50 ? ' is-wet' : ''}`}>{day.pm.precipitationProbability}%</span>
      </span>
      <span className="week-row__temps">
        <span className="t-min" aria-label={`Low ${formatTemp(day.temperatureMin)}`}>
          {formatTemp(day.temperatureMin)}
        </span>
        <span className="range" aria-hidden="true">
          <span className="range__bar" data-testid="range-bar" style={{ left: `${left}%`, width: `${width}%` }} />
        </span>
        <span className="t-max" aria-label={`High ${formatTemp(day.temperatureMax)}`}>
          {formatTemp(day.temperatureMax)}
        </span>
      </span>
    </li>
  );
}

export function WeeklyCard({ daily, today }: { daily: DailyPoint[]; today: string }) {
  const { min, max } = weekExtent(daily);
  return (
    <Card title={`${daily.length}-day forecast`} className="weekly-card">
      <div className="week-head" aria-hidden="true">
        <span />
        <span>AM</span>
        <span>PM</span>
        <span>Low · High</span>
      </div>
      <ol className="week-list">
        {daily.map((d) => (
          <WeeklyRow key={d.date} day={d} today={today} weekMin={min} weekMax={max} />
        ))}
      </ol>
    </Card>
  );
}
