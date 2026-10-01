import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiMeta } from '@contract';

export interface AggregateMeta {
  mock: boolean;
  stale: boolean;
  providers: string[];
  fetchedAt: string | null;
}

const EMPTY: AggregateMeta = { mock: false, stale: false, providers: [], fetchedAt: null };

function hasMeta(d: unknown): d is { meta: ApiMeta } {
  return typeof d === 'object' && d !== null && 'meta' in d && typeof (d as { meta: ApiMeta }).meta?.provider === 'string';
}

/** Combines `meta` from every query currently on screen (for the footer badges). */
export function useAggregateMeta(): AggregateMeta {
  const client = useQueryClient();
  const [state, setState] = useState<AggregateMeta>(EMPTY);

  useEffect(() => {
    const cache = client.getQueryCache();
    const compute = () => {
      const metas = cache
        .getAll()
        .filter((q) => q.getObserversCount() > 0 && hasMeta(q.state.data))
        .map((q) => (q.state.data as { meta: ApiMeta }).meta);
      const next: AggregateMeta = {
        mock: metas.some((m) => m.mock),
        stale: metas.some((m) => m.stale),
        providers: [...new Set(metas.map((m) => m.provider))].sort(),
        fetchedAt: metas.map((m) => m.fetchedAt).sort().at(-1) ?? null,
      };
      setState((prev) =>
        prev.mock === next.mock && prev.stale === next.stale && prev.fetchedAt === next.fetchedAt && prev.providers.join() === next.providers.join()
          ? prev
          : next,
      );
    };
    compute();
    return cache.subscribe(() => queueMicrotask(compute));
  }, [client]);

  return state;
}
