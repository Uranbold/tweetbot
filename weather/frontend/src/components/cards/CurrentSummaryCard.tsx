import type { ApiMeta, TodayWeather } from '@contract';
import { WeatherIcon } from '../icons/WeatherIcon';
import { ArrowIcon, StarIcon } from '../icons/UiIcons';
import { formatClock, formatInstantClock, formatTemp, formatWindSpeed, windArrowRotation } from '../../lib/format';
import { gradeColor, gradeLabel } from '../../lib/air';
import { LEVEL_COLORS, LEVEL_LABELS, uvLevel } from '../../lib/levels';
import { placeSubtitle } from '../../lib/places';

interface Props {
  weather: TodayWeather;
  meta?: ApiMeta;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function CurrentSummaryCard({ weather, meta, isFavorite = false, onToggleFavorite }: Props) {
  const { location, current, comparison, today, air } = weather;
  const diff = comparison.temperatureDiff;
  const trend = diff > 0 ? 'warmer' : diff < 0 ? 'colder' : 'same';
  const uv = uvLevel(current.uvIndex);
  const subtitle = placeSubtitle(location);

  return (
    <section className="card current" aria-labelledby="current-title" data-testid="current-card">
      <header className="current__head">
        <div>
          <h1 id="current-title" className="current__place">
            {location.name}
          </h1>
          {subtitle && <p className="current__sub">{subtitle}</p>}
        </div>
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
        <WeatherIcon condition={current.condition} size={88} className="current__icon" />
        <div>
          <p className="current__temp" aria-label={`Temperature ${formatTemp(current.temperature, 1)}C`}>
            {formatTemp(current.temperature, 1)}
          </p>
          <p className="current__cond">{current.condition.label}</p>
        </div>
      </div>

      <p className={`current__compare is-${trend}`} data-testid="comparison">
        {trend !== 'same' && <ArrowIcon size={14} rotation={trend === 'warmer' ? 0 : 180} />}
        {comparison.message}
      </p>
      {today.headline && <p className="current__headline">{today.headline}</p>}

      <dl className="current__details">
        <div>
          <dt>Feels like</dt>
          <dd>{formatTemp(current.feelsLike, 1)}</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{current.humidity}%</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd className="current__wind">
            <ArrowIcon size={14} rotation={windArrowRotation(current.windDirection)} label={`Wind from ${current.windDirectionLabel}`} />
            {current.windDirectionLabel} {formatWindSpeed(current.windSpeed)}
          </dd>
        </div>
        <div>
          <dt>Low / High</dt>
          <dd>
            <span className="t-min">{formatTemp(today.temperatureMin)}</span> / <span className="t-max">{formatTemp(today.temperatureMax)}</span>
          </dd>
        </div>
      </dl>

      <ul className="chips" aria-label="Today at a glance">
        <li className="chip" style={{ ['--chip' as string]: gradeColor(air?.pm10Grade) }}>
          <span className="chip__dot" aria-hidden="true" />
          Fine dust <strong>{gradeLabel(air?.pm10Grade)}</strong>
        </li>
        <li className="chip" style={{ ['--chip' as string]: gradeColor(air?.pm25Grade) }}>
          <span className="chip__dot" aria-hidden="true" />
          Ultra-fine dust <strong>{gradeLabel(air?.pm25Grade)}</strong>
        </li>
        <li className="chip" style={{ ['--chip' as string]: LEVEL_COLORS[uv] }}>
          <span className="chip__dot" aria-hidden="true" />
          UV <strong>{LEVEL_LABELS[uv]}</strong>
        </li>
        <li className="chip chip--plain">
          Sunrise <strong>{formatClock(today.sunrise)}</strong>
        </li>
        <li className="chip chip--plain">
          Sunset <strong>{formatClock(today.sunset)}</strong>
        </li>
      </ul>
      {meta && (
        <p className="current__updated">
          Updated {formatInstantClock(meta.fetchedAt, location.timezone)} local time · {location.timezone}
        </p>
      )}
    </section>
  );
}
