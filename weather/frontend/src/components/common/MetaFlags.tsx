import type { ApiMeta } from '@contract';
import { formatInstantClock } from '../../lib/format';

/** "Demo data" / "Stale" labels shown on the card that uses the data (UX §1.4 honest data). */
export function MetaFlags({ meta, timeZone, showUpdated = false }: { meta?: ApiMeta; timeZone?: string; showUpdated?: boolean }) {
  if (!meta) return null;
  const updated = formatInstantClock(meta.fetchedAt, timeZone);
  if (!meta.mock && !meta.stale && !showUpdated) return null;
  return (
    <span className="meta-flags">
      {meta.mock && (
        <span className="flag flag--demo" title="Served by the deterministic demo provider (upstream unavailable or mock mode).">
          Demo data
        </span>
      )}
      {meta.stale && (
        <span className="flag flag--stale" title="The provider failed; this is the last cached copy.">
          Stale · {updated}
        </span>
      )}
    </span>
  );
}
