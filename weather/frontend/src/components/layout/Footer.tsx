import { useAggregateMeta } from '../../hooks/useAggregateMeta';
import { formatInstantClock } from '../../lib/format';

export function Footer() {
  const meta = useAggregateMeta();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__badges" aria-live="polite">
          {meta.mock && (
            <span className="badge badge--demo" title="The backend is serving deterministic demo data (upstream unavailable or mock mode).">
              Demo data
            </span>
          )}
          {meta.stale && (
            <span className="badge badge--stale" title="Upstream failed; showing the last cached data.">
              Stale
            </span>
          )}
          {meta.providers.length > 0 && <span className="muted small">Provider: {meta.providers.join(', ')}</span>}
          {meta.fetchedAt && <span className="muted small">Fetched {formatInstantClock(meta.fetchedAt)} (your time)</span>}
        </div>
        <p className="site-footer__attr">
          Weather data by{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo.com
          </a>{' '}
          (
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          ). Map tiles ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{' '}
          contributors. Air quality grades follow the Korean MoE 4-tier scale.
        </p>
        <p className="muted small">Skycast · °C · m/s · µg/m³</p>
      </div>
    </footer>
  );
}
