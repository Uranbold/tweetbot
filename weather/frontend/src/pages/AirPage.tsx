import { useEffect, useState } from 'react';
import { useAir } from '../api/hooks';
import { useLocationState } from '../hooks/useLocationState';
import { Card } from '../components/common/Card';
import { Segmented } from '../components/common/Segmented';
import { SkeletonCard } from '../components/common/Skeleton';
import { ErrorState } from '../components/common/ErrorState';
import { GradeBadge } from '../components/common/GradeBadge';
import { Gauge } from '../components/charts/Gauge';
import { AirHourlyChart, AirHourlyTable } from '../components/charts/AirHourlyChart';
import { ViewToggle } from '../components/common/ViewToggle';
import { MetaFlags } from '../components/common/MetaFlags';
import { GradeFace } from '../components/icons/GradeFace';
import { AIR_GRADE_ADVICE, AIR_GRADE_COLORS, gradeLabel } from '../lib/air';
import { datePart, formatClock, formatMonthDay, relativeDayLabel } from '../lib/format';
import { placeSubtitle } from '../lib/places';

const POLLUTANTS = [
  { key: 'o3', label: 'Ozone', code: 'O₃' },
  { key: 'no2', label: 'Nitrogen dioxide', code: 'NO₂' },
  { key: 'so2', label: 'Sulphur dioxide', code: 'SO₂' },
  { key: 'co', label: 'Carbon monoxide', code: 'CO' },
] as const;

export default function AirPage() {
  const { place } = useLocationState();
  const q = useAir(place.lat, place.lon);
  const [pollutant, setPollutant] = useState<'pm10' | 'pm25'>('pm10');
  const [table, setTable] = useState(false);

  useEffect(() => {
    document.title = `Air quality · ${q.data?.data.location.name ?? place.name} · Skycast`;
  }, [q.data, place.name]);

  if (q.isPending) {
    return (
      <div className="col" aria-busy="true">
        <SkeletonCard lines={4} height={320} label="Loading air quality" />
        <SkeletonCard lines={3} height={220} />
      </div>
    );
  }
  if (q.isError && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load air quality" />;

  const { location, current, hourly, daily, scale } = q.data.data;
  const today = datePart(current.time);
  const sub = placeSubtitle(location);

  return (
    <div className="page-air">
      <section className="card air-hero" aria-labelledby="air-title" style={{ ['--grade' as string]: AIR_GRADE_COLORS[current.overallGrade] }}>
        <header className="air-hero__head">
          <div>
            <h1 id="air-title" className="current__place">
              {location.name} air quality
            </h1>
            <p className="current__sub">
              {sub ? `${sub} · ` : ''}As of {formatClock(current.time)} local
            </p>
          </div>
          <span className="air-hero__flags">
            <MetaFlags meta={q.data.meta} timeZone={location.timezone} />
            <GradeBadge grade={current.overallGrade} size="lg" />
          </span>
        </header>
        <p className="air-hero__advice">{AIR_GRADE_ADVICE[current.overallGrade]}</p>
        <div className="gauges">
          <Gauge label="Fine dust (PM10)" value={current.pm10} grade={current.pm10Grade} scale={scale.pm10} />
          <Gauge label="Ultra-fine dust (PM2.5)" value={current.pm25} grade={current.pm25Grade} scale={scale.pm25} />
        </div>
        <ul className="pollutants" aria-label="Other pollutants">
          {POLLUTANTS.map((p) => (
            <li key={p.key} className="pollutant">
              <span className="pollutant__code">{p.code}</span>
              <span className="pollutant__value">
                {Math.round(current[p.key])}
                <small> µg/m³</small>
              </span>
              <span className="pollutant__label">{p.label}</span>
            </li>
          ))}
          {current.usAqi != null && (
            <li className="pollutant">
              <span className="pollutant__code">US AQI</span>
              <span className="pollutant__value">{current.usAqi}</span>
              <span className="pollutant__label">EPA index</span>
            </li>
          )}
        </ul>
      </section>

      <div className="layout-air">
        <Card
          title="Hourly forecast"
          className="air-hourly"
          headerExtra={<span className="card__hint">Next {hourly.length} h</span>}
          toolbar={<ViewToggle table={table} onChange={setTable} />}
        >
          <Segmented
            options={[
              { value: 'pm10', label: 'PM10' },
              { value: 'pm25', label: 'PM2.5' },
            ]}
            value={pollutant}
            onChange={setPollutant}
            label="Pollutant"
          />
          {table ? <AirHourlyTable hourly={hourly} today={today} /> : <AirHourlyChart hourly={hourly} pollutant={pollutant} today={today} />}
          <Legend scale={pollutant === 'pm10' ? scale.pm10 : scale.pm25} name={pollutant === 'pm10' ? 'PM10' : 'PM2.5'} />
        </Card>

        <Card title={`${daily.length}-day dust forecast`} className="air-daily">
          <ol className="air-days">
            {daily.map((d) => (
              <li key={d.date} className="air-day">
                <span className="air-day__date">
                  <strong>{relativeDayLabel(d.date, today)}</strong>
                  <span className="muted small">{formatMonthDay(d.date)}</span>
                </span>
                <span className="air-day__cell">
                  <span className="muted small">PM10</span>
                  <GradeBadge grade={d.pm10Grade} size="sm" />
                  <span className="small">max {Math.round(d.pm10Max)}</span>
                </span>
                <span className="air-day__cell">
                  <span className="muted small">PM2.5</span>
                  <GradeBadge grade={d.pm25Grade} size="sm" />
                  <span className="small">max {Math.round(d.pm25Max)}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Legend({ scale, name }: { scale: { grade: keyof typeof AIR_GRADE_COLORS; min: number; max: number | null }[]; name: string }) {
  return (
    <div className="legend" aria-label={`${name} grade thresholds`}>
      <span className="legend__title">{name} µg/m³</span>
      <ul className="legend__list">
        {scale.map((b) => (
          <li key={b.grade} className="legend__item">
            <GradeFace grade={b.grade} size={16} />
            <span>{gradeLabel(b.grade)}</span>
            <span className="muted">{b.max == null ? `${b.min}+` : `${b.min}–${b.max}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
