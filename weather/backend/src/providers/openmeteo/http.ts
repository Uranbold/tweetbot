import { UpstreamError } from '../../errors.js';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpOptions {
  timeoutMs: number;
  fetch?: FetchLike;
  /** Name used in error messages / logs. */
  upstream: string;
}

/** GET a JSON document with a hard timeout, mapping every failure to an UpstreamError. */
export async function getJson(url: string, opts: HttpOptions): Promise<unknown> {
  const doFetch = opts.fetch ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  let res: Response;
  try {
    res = await doFetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) throw new UpstreamError(opts.upstream, 'timeout', `timed out after ${opts.timeoutMs} ms`, undefined, { cause: err });
    throw new UpstreamError(opts.upstream, 'network', (err as Error).message ?? 'network error', undefined, { cause: err });
  }
  try {
    const text = await res.text();
    if (!res.ok) {
      const reason = extractReason(text) ?? res.statusText;
      const kind = res.status === 429 ? 'rate-limited' : res.status >= 500 ? 'server' : 'client';
      throw new UpstreamError(opts.upstream, kind, `HTTP ${res.status}${reason ? ` — ${reason}` : ''}`, res.status);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (err) {
      throw new UpstreamError(opts.upstream, 'parse', 'invalid JSON', res.status, { cause: err });
    }
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    if (controller.signal.aborted) throw new UpstreamError(opts.upstream, 'timeout', `timed out after ${opts.timeoutMs} ms`, undefined, { cause: err });
    throw new UpstreamError(opts.upstream, 'network', (err as Error).message, undefined, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

function extractReason(body: string): string | undefined {
  try {
    const j = JSON.parse(body) as { reason?: unknown; error?: unknown; message?: unknown };
    const r = j.reason ?? j.message ?? (typeof j.error === 'string' ? j.error : undefined);
    return typeof r === 'string' ? r.slice(0, 200) : undefined;
  } catch {
    return body ? body.slice(0, 200) : undefined;
  }
}

export function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  // Open-Meteo expects literal commas in list parameters.
  return url.toString().replace(/%2C/gi, ',');
}
