import type { AiPrediction } from '@contract';
import { usePredict } from '../../api/hooks';
import { ApiRequestError } from '../../api/client';
import { Card } from '../common/Card';
import { Skeleton } from '../common/Skeleton';
import { RefreshIcon } from '../icons/UiIcons';
import { AiBandChart } from '../charts/AiBandChart';
import { HAZARD_LABELS } from '../../lib/hazards';
import { SEVERITY_LABELS } from '../../lib/levels';
import { datePart, formatClock, formatMonthDay, relativeDayLabel } from '../../lib/format';

/** Self-contained card: its own query, so an AI outage never affects the rest of Home. */
export function AiForecastCard({ lat, lon, today }: { lat: number; lon: number; today: string }) {
  const q = usePredict(lat, lon, 72);
  return (
    <Card title="AI forecast" className="ai-card" headerExtra={<span className="ai-badge">Beta</span>} testId="ai-card">
      {q.isPending ? (
        <div className="ai-loading" role="status" aria-label="Loading AI forecast">
          <Skeleton height={14} width="85%" />
          <Skeleton height={10} width="60%" />
          <Skeleton height={120} />
        </div>
      ) : q.isError ? (
        <div className="ai-unavailable" role="status">
          <p>
            <strong>AI forecast unavailable</strong>
            <span className="muted small">
              {q.error instanceof ApiRequestError && q.error.code === 'UPSTREAM_UNAVAILABLE'
                ? ' The prediction service is offline right now. The regular forecast above is unaffected.'
                : ' Could not load the AI forecast.'}
            </span>
          </p>
          <button type="button" className="btn btn--ghost" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshIcon size={14} /> Retry
          </button>
        </div>
      ) : (
        <AiBody p={q.data.data} today={today} />
      )}
    </Card>
  );
}

function AiBody({ p, today }: { p: AiPrediction; today: string }) {
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
      <p className="ai-summary">{p.summary}</p>
      {risks.length > 0 && (
        <ul className="ai-risks" aria-label="Hazard risks">
          {risks.map((r) => {
            const pct = Math.round(r.probability * 100);
            return (
              <li key={r.hazard} className={`ai-risk ai-risk--${r.severity}`} data-testid="ai-risk">
                <div className="ai-risk__top">
                  <span className="ai-risk__name">
                    {HAZARD_LABELS[r.hazard] ?? r.hazard}
                    <span className="ai-risk__sev">{SEVERITY_LABELS[r.severity]}</span>
                  </span>
                  <span className="ai-risk__pct">{pct}%</span>
                </div>
                <span
                  className="ai-risk__track"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${HAZARD_LABELS[r.hazard] ?? r.hazard} probability`}
                >
                  <span className="ai-risk__bar" style={{ width: `${pct}%` }} />
                </span>
                <p className="ai-risk__why">
                  {r.expectedStart && (
                    <span className="ai-risk__when">
                      From {relativeDayLabel(datePart(r.expectedStart), today) === 'Today' ? 'today' : formatMonthDay(datePart(r.expectedStart))} {formatClock(r.expectedStart)} ·{' '}
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
          <span className="swatch swatch--line" style={{ background: 'var(--ai-line)' }} />
          AI temperature
        </li>
        <li className="legend__item">
          <span className="swatch" style={{ background: 'var(--ai-band)' }} />
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
