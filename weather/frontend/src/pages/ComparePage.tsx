import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ForecastComparison, ModelId } from '@contract';
import { useCompare } from '../api/hooks';
import { useLocationState } from '../hooks/useLocationState';
import { Card } from '../components/common/Card';
import { SkeletonCard } from '../components/common/Skeleton';
import { ErrorState } from '../components/common/ErrorState';
import { WeatherIcon } from '../components/icons/WeatherIcon';
import { MultiLineChart } from '../components/charts/MultiLineChart';
import { MODELS, modelInfo, parseModels } from '../lib/models';
import { datePart, formatMonthDay, formatPrecip, formatTemp, relativeDayLabel } from '../lib/format';
import { placeSubtitle } from '../lib/places';

const AGREEMENT_LABEL = { high: 'High agreement', medium: 'Some spread', low: 'Low agreement' } as const;

export default function ComparePage() {
  const { place } = useLocationState();
  const [sp, setSp] = useSearchParams();
  const models = useMemo(() => parseModels(sp.get('models')), [sp]);
  const q = useCompare(place.lat, place.lon, models);

  useEffect(() => {
    document.title = `Compare forecasts · ${q.data?.data.location.name ?? place.name} · Skycast`;
  }, [q.data, place.name]);

  const toggle = (id: ModelId) => {
    const next = models.includes(id) ? models.filter((m) => m !== id) : [...models, id];
    setSp(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('models', MODELS.map((m) => m.id).filter((m) => next.includes(m)).join(','));
        return p;
      },
      { replace: true },
    );
  };

  return (
    <div className="page-compare">
      <section className="card" aria-labelledby="compare-title">
        <h1 id="compare-title" className="current__place">
          Compare forecasts
        </h1>
        <p className="current__sub">
          {q.data ? `${q.data.data.location.name}${placeSubtitle(q.data.data.location) ? ` · ${placeSubtitle(q.data.data.location)}` : ''}` : place.name} — how
          different weather models see the coming days.
        </p>
        <fieldset className="model-picker">
          <legend className="visually-hidden">Models to compare</legend>
          {MODELS.map((m) => {
            const on = models.includes(m.id);
            return (
              <label key={m.id} className={`model-chip${on ? ' is-on' : ''}`} style={{ ['--series' as string]: m.color }}>
                <input type="checkbox" checked={on} onChange={() => toggle(m.id)} disabled={on && models.length === 1} />
                <span className="swatch" aria-hidden="true" />
                <span>{m.label}</span>
                <span className="model-chip__agency">{m.agency}</span>
              </label>
            );
          })}
        </fieldset>
      </section>

      {models.length === 0 ? (
        <div className="card">
          <p className="muted">Select at least one model.</p>
        </div>
      ) : q.isPending ? (
        <>
          <SkeletonCard lines={6} height={300} label="Loading model comparison" />
          <SkeletonCard lines={3} height={260} />
        </>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load model comparison" />
      ) : (
        <CompareBody data={q.data.data} refreshing={q.isFetching} />
      )}
    </div>
  );
}

function CompareBody({ data, refreshing }: { data: ForecastComparison; refreshing: boolean }) {
  const today = datePart(data.models[0]?.hourly[0]?.time ?? data.consensus[0]?.date ?? '1970-01-01');
  const dates = data.consensus.length ? data.consensus.map((c) => c.date) : (data.models[0]?.daily.map((d) => d.date) ?? []);
  const series = data.models.map((m) => ({
    id: m.model,
    label: m.label,
    color: modelInfo(m.model).color,
    points: m.hourly.map((h) => ({ time: h.time, value: h.temperature })),
  }));

  return (
    <div className={refreshing ? 'is-refreshing' : undefined}>
      <Card title="Daily high / low by model" className="compare-table-card">
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Daily forecast by model table">
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col" className="sticky-col">
                  Model
                </th>
                {dates.map((d) => (
                  <th key={d} scope="col">
                    <span className="compare-table__day">{relativeDayLabel(d, today)}</span>
                    <span className="muted small">{formatMonthDay(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr key={m.model}>
                  <th scope="row" className="sticky-col">
                    <span className="model-name">
                      <span className="swatch" style={{ background: modelInfo(m.model).color }} aria-hidden="true" />
                      <span>
                        {m.label}
                        <span className="model-name__agency">{m.agency}</span>
                      </span>
                    </span>
                  </th>
                  {dates.map((d) => {
                    const day = m.daily.find((x) => x.date === d);
                    if (!day) return <td key={d} className="muted">–</td>;
                    return (
                      <td key={d}>
                        <WeatherIcon condition={day.condition} size={26} />
                        <span className="compare-cell__temps">
                          <span className="t-max">{formatTemp(day.temperatureMax)}</span>
                          <span className="t-min">{formatTemp(day.temperatureMin)}</span>
                        </span>
                        <span className={`compare-cell__precip${day.precipitationSum >= 1 ? ' is-wet' : ''}`}>{formatPrecip(day.precipitationSum)} mm</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {data.consensus.length > 0 && (
              <tfoot>
                <tr>
                  <th scope="row" className="sticky-col">
                    Consensus
                    <span className="model-name__agency">mean high · spread</span>
                  </th>
                  {data.consensus.map((c) => (
                    <td key={c.date}>
                      <span className="t-max">{formatTemp(c.temperatureMaxMean, 1)}</span>
                      <span className="muted small">±{(c.temperatureMaxSpread / 2).toFixed(1)}°</span>
                      <span className={`agree agree--${c.agreement}`} title={`Max temperature spread ${c.temperatureMaxSpread.toFixed(1)}°`}>
                        {AGREEMENT_LABEL[c.agreement]}
                      </span>
                      <span className="small muted">{formatPrecip(c.precipitationSumMean)} mm</span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      <Card title="Hourly temperature by model" className="compare-chart-card">
        <ul className="legend__list legend__list--series" aria-label="Legend">
          {series.map((s) => (
            <li key={s.id} className="legend__item">
              <span className="swatch swatch--line" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        <MultiLineChart series={series} today={today} />
      </Card>
    </div>
  );
}
