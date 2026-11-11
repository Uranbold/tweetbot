import { useState } from 'react';
import type { AiPrediction } from '@contract';
import { usePredict } from '../../api/hooks';
import { ApiRequestError } from '../../api/client';
import { Card } from '../common/Card';
import { Skeleton } from '../common/Skeleton';
import { MetaFlags } from '../common/MetaFlags';
import { RefreshIcon } from '../icons/UiIcons';
import { HazardGlyph } from '../icons/HazardGlyph';
import { AiBandChart } from '../charts/AiBandChart';
import { HAZARD_LABELS } from '../../lib/hazards';
import { SEVERITY_LABELS } from '../../lib/levels';
import { datePart, formatClock, formatMonthDay, relativeDayLabel } from '../../lib/format';

/** Self-contained card (UX §4.6): its own query, so an AI outage never affects the rest of Home. */
export function AiForecastCard({ lat, lon, today }: { lat: number; lon: number; today: string }) {
  const q = usePredict(lat, lon, 72);
  const [info, setInfo] = useState(false);
  const p = q.data?.data;
  const climatology = p?.model.algorithm === 'climatology-fallback';
  return (
    <Card
      title="AI forecast"
      className="ai-card"
      testId="ai-card"
      headerExtra={
        <>
          <span className="flag flag--ai">{climatology ? 'Climatology estimate' : 'AI estimate'}</span>
          {p && (
            <button type="button" className="icon-btn icon-btn--sm" aria-label="About this model" aria-expanded={info} aria-controls="ai-model-info" onClick={() => setInfo((v) => !v)}>
              ?
            </button>
          )}
        </>
      }
      toolbar={<MetaFlags meta={q.data?.meta} />}
    >
      {q.isPending ? (
        <div className="ai-loading" role="status" aria-label="Loading AI forecast">
          <Skeleton height={15} width="85%" />
          <Skeleton height={15} width="60%" />
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={150} />
        </div>
      ) : q.isError ? (
        <div className="ai-unavailable" role="status">
          <p>
            <strong>AI forecast unavailable</strong>{' '}
            <span className="muted small">
              {q.error instanceof ApiRequestError && q.error.code === 'UPSTREAM_UNAVAILABLE'
                ? 'The prediction service is offline. The regular forecast is unaffected.'
                : 'Could not load the AI forecast.'}
            </span>
          </p>
          <button type="button" className="btn btn--quiet" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshIcon size={14} /> Retry
          </button>
        </div>
      ) : (
        <AiBody p={q.data.data} today={today} showInfo={info} />
      )}
    </Card>
  );
}

function AiBody({ p, today, showInfo }: { p: AiPrediction; today: string; showInfo: boolean }) {
  const risks = p.risks.slice(0, 3);
  const m = p.model;
  const footer = [
    m.name,
    m.metrics.temperatureMae != null
      ? `MAE ${m.metrics.temperatureMae.toFixed(1)}°${m.metrics.temperatureMaeNwp != null ? ` vs ${m.metrics.temperatureMaeNwp.toFixed(1)}° raw` : ''}`
      : null,
    m.trainingSamples > 0 ? `${m.trainingSamples.toLocaleString('en-US')} samples` : 'climatology fallback',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {showInfo && (
        <dl className="ai-info" id="ai-model-info">
          <dt>Model</dt>
          <dd>
            {m.name} v{m.version}
          </dd>
          <dt>Algorithm</dt>
          <dd>{m.algorithm}</dd>
          <dt>Trained</dt>
          <dd>{m.trainedAt.slice(0, 10)}</dd>
          <dt>Samples</dt>
          <dd>{m.trainingSamples.toLocaleString('en-US')}</dd>
          {m.metrics.temperatureMae != null && (
            <>
              <dt>Temperature MAE</dt>
              <dd>
                {m.metrics.temperatureMae.toFixed(1)}°{m.metrics.temperatureMaeNwp != null ? ` (raw model ${m.metrics.temperatureMaeNwp.toFixed(1)}°)` : ''}
              </dd>
            </>
          )}
          {m.metrics.precipitationBrier != null && (
            <>
              <dt>Rain Brier score</dt>
              <dd>{m.metrics.precipitationBrier.toFixed(2)}</dd>
            </>
          )}
          <dt>Features</dt>
          <dd>{m.features.join(', ')}</dd>
        </dl>
      )}
      <p className="ai-summary">{p.summary}</p>
      {risks.length > 0 && (
        <ul className="ai-risks" aria-label="Hazard risks">
          {risks.map((r) => {
            const pct = Math.round(r.probability * 100);
            const name = HAZARD_LABELS[r.hazard] ?? r.hazard;
            return (
              <li key={r.hazard} className={`ai-risk ai-risk--${r.severity}`} data-testid="ai-risk">
                <div className="ai-risk__top">
                  <span className="ai-risk__name">
                    <HazardGlyph hazard={r.hazard} />
                    {name}
                    <span className="ai-risk__sev">{SEVERITY_LABELS[r.severity]}</span>
                  </span>
                  <span className="ai-risk__pct">AI estimate · {pct}%</span>
                </div>
                <span className="ai-risk__track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${name} probability`}>
                  <span className="ai-risk__bar" style={{ width: `${pct}%` }} />
                </span>
                <p className="ai-risk__why">
                  {r.expectedStart && (
                    <span className="ai-risk__when">
                      Likely from {relativeDayLabel(datePart(r.expectedStart), today) === 'Today' ? 'today' : formatMonthDay(datePart(r.expectedStart))} {formatClock(r.expectedStart)} ·{' '}
                    </span>
                  )}
                  {r.rationale}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <ul className="legend__list ai-legend" aria-hidden="true">
        <li className="legend__item">
          <span className="swatch swatch--line swatch--fg" />
          AI temperature
        </li>
        <li className="legend__item">
          <span className="swatch swatch--band" />
          P10–P90 range
        </li>
        <li className="legend__item">
          <span className="swatch swatch--line swatch--dashed" />
          Raw model
        </li>
      </ul>
      <AiBandChart hourly={p.hourly} today={today} />
      <p className="ai-footer" data-testid="ai-footer">
        {footer}
      </p>
    </>
  );
}
