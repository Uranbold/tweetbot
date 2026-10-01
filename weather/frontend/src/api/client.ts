import type { ApiError, ApiResponse } from '@contract';

export const API_BASE = '/api/v1';

export type ApiErrorCode = ApiError['error']['code'] | 'NETWORK' | 'BAD_RESPONSE';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }

  /** Client errors (4xx except 429) will not succeed on retry. */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

export type QueryParams = Record<string, string | number | undefined | null>;

export function buildUrl(path: string, params?: QueryParams): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const qs = sp.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'error' in body && typeof (body as ApiError).error?.message === 'string';
}

function isEnvelope<T>(body: unknown): body is ApiResponse<T> {
  return typeof body === 'object' && body !== null && 'data' in body && 'meta' in body;
}

/** GET a contract endpoint. Resolves with the full envelope so callers can read `meta`. */
export async function apiGet<T>(path: string, params?: QueryParams, signal?: AbortSignal): Promise<ApiResponse<T>> {
  if (__USE_FIXTURES__) {
    const { fixtureResponse } = await import('../__fixtures__/handler');
    return fixtureResponse<T>(path, params ?? {}, signal);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, params), { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiRequestError('Network error — could not reach the weather service.', 0, 'NETWORK');
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    if (isApiError(body)) throw new ApiRequestError(body.error.message, res.status, body.error.code);
    throw new ApiRequestError(`Request failed (${res.status})`, res.status, res.status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
  }
  if (!isEnvelope<T>(body)) throw new ApiRequestError('Unexpected response from the weather service.', res.status, 'BAD_RESPONSE');
  return body;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) {
    switch (err.code) {
      case 'UPSTREAM_UNAVAILABLE':
        return 'The weather provider is temporarily unavailable.';
      case 'RATE_LIMITED':
        return 'Too many requests — please wait a moment.';
      case 'NOT_FOUND':
        return 'No data found for this location.';
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}
