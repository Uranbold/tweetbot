import type { ApiMeta, TodayWeather } from '@contract';
import { WeatherIcon } from '../icons/WeatherIcon';
import { ArrowIcon, StarIcon } from '../icons/UiIcons';
import { GradeChip } from '../common/GradeBadge';
import { MetaFlags } from '../common/MetaFlags';
import { formatClock, formatInstantClock, formatTemp, formatWindSpeed, roundTemp, windArrowRotation } from '../../lib/format';
import { LEVEL_LABELS, uvLevel } from '../../lib/levels';
import { placeSubtitle } from '../../lib/places';
import { decisionLine } from '../../lib/decision';
import { useCountUp } from '../../hooks/useCountUp';

interface Props {
  weather: TodayWeather;
  meta?: ApiMeta;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** False when a warning banner is the loudest element on the page (Von Restorff). */
  loud?: boolean;
}

/** UX §4.1 hero card: the answer first (temperature, condition, delta, air, decision). */
export function CurrentSummaryCard({ weather, meta, isFavorite = false, onToggleFavorite, loud = true }: Props) {
  const { location, current, comparison, today, air } = weather;
  const diff = comparison.temperatureDiff;
  const trend = diff > 0 ? 'warmer' : diff < 0 ? 'colder' : 'same';
  const uv = uvLevel(current.uvIndex);
  const subtitle = placeSubtitle(location);
  const shown = useCountUp(current.temperature);
  const decision = decisionLine(weather);

  return (
    <section className={`card current${loud ? '' : ' current--quiet'}`} aria-labelledby="current-title" data-testid="current-card">
      <header className="current__head">
        <div className="current__where">
          <h1 id="current-title" className="current__place">
            {location.name}
          </h1>
          {subtitle && <p className="current__sub">{subtitle}</p>}
        </div>
        <MetaFlags meta={meta} timeZone={location.timezone} />
        {onToggleFavorite && (
          <button
            type="button"
            className={`icon-btn star-btn${isFavorite ? ' is-on' : ''}`}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? `Remove ${location.name} from favorites` : `Add ${location.name} to favorites`}
            onClick={onToggleFavorite}
          >
            <StarIcon filled={isFavorite} size={22} />
          </button>
        )}
      </header>

      <div className="current__main">
        <p className="current__temp" aria-label={`Temperature ${formatTemp(current.temperature)}`} data-value={roundTemp(current.temperature)}>
          {roundTemp(shown).toFixed(0)}
          <span className="current__deg">°</span>
        </p>
        <div className="current__cond-wrap">
          <WeatherIcon condition={current.condition} size={64} className="current__icon" label="" />
          <p className="current__cond">{current.condition.label}</p>
          <p className="current__range">
            <span className="t-min" aria-label={`Low ${formatTemp(today.temperatureMin)}`}>
              ↓{formatTemp(today.temperatureMin)}
            </span>{' '}
            <span className="t-max" aria-label={`High ${formatTemp(today.temperatureMax)}`}>
              ↑{formatTemp(today.temperatureMax)}
            </span>
          </p>
        </div>
      </div>

      <p className={`current__compare is-${trend}`} data-testid="comparison">
        {trend !== 'same' && <ArrowIcon size={14} rotation={trend === 'warmer' ? 0 : 180} />}
        {comparison.message}
      </p>

      <dl className="current__details">
        <div>
          <dt>Feels like</dt>
          <dd>{formatTemp(current.feelsLike)}</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{current.humidity}%</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd className="current__wind">
            <ArrowIcon size={14} rotation={windArrowRotation(current.windDirection)} label={`Wind from ${current.windDirectionLabel}`} />
            {formatWindSpeed(current.windSpeed)}
          </dd>
        </div>
        <div>
          <dt>UV</dt>
          <dd>
            {Math.round(current.uvIndex)} <span className="current__uvword">{LEVEL_LABELS[uv]}</span>
          </dd>
        </div>
      </dl>

      <ul className="chips" aria-label="Today at a glance">
        <li>
          <GradeChip grade={air?.pm10Grade} name="PM10" value={air?.pm10} />
        </li>
        <li>
          <GradeChip grade={air?.pm25Grade} name="PM2.5" value={air?.pm25} />
        </li>
        <li className="chip">
          Sunrise <strong>{formatClock(today.sunrise)}</strong>
        </li>
        <li className="chip">
          Sunset <strong>{formatClock(today.sunset)}</strong>
        </li>
      </ul>

      {decision && (
        <p className="current__decision" data-testid="decision">
          {decision}
        </p>
      )}
      {today.headline && <p className="current__headline">{today.headline}</p>}
      {meta && (
        <p className="current__updated">
          Updated {formatInstantClock(meta.fetchedAt, location.timezone)}
          {meta.stale ? ' · stale' : ''} · {location.timezone}
        </p>
      )}
    </section>
  );
}
