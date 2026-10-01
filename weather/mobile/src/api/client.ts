import type {
  AiPrediction,
  AirQualityReport,
  AirQualitySnapshot,
  ApiError,
  ApiMeta,
  ApiResponse,
  Device,
  DeviceRegistration,
  HazardRisk,
  NotificationHistoryEntry,
  NotificationMessage,
  Region,
  TodayWeather,
  WeatherAlert,
} from '@contract';

export const DEFAULT_BASE_URL = 'http://localhost:8787/api/v1';

export type ApiErrorCode = ApiError['error']['code'] | 'NETWORK' | 'PARSE';

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

export interface Coords {
  lat: number;
  lon: number;
}

export type RegionAlerts = { alerts: WeatherAlert[]; risks: HazardRisk[]; air: AirQualitySnapshot | null };

/** `{data, meta}` already unwrapped — the shape every hook returns. */
export type Result<T> = { data: T; meta: ApiMeta };

export interface ClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  /** Serve bundled fixtures instead of hitting the network. */
  useFixtures?: boolean;
  timeoutMs?: number;
}

export interface ApiClient {
  baseUrl: string;
  useFixtures: boolean;
  request<T>(method: string, path: string, body?: unknown): Promise<Result<T>>;
  getWeather(c: Coords): Promise<Result<TodayWeather>>;
  getAir(c: Coords): Promise<Result<AirQualityReport>>;
  getPredict(c: Coords, hours?: number): Promise<Result<AiPrediction>>;
  getRegions(): Promise<Result<Region[]>>;
  getRegionAlerts(regionId: string): Promise<Result<RegionAlerts>>;
  registerDevice(reg: DeviceRegistration): Promise<Result<Device>>;
  getDevice(id: string): Promise<Result<Device>>;
  patchDevice(id: string, patch: Partial<DeviceRegistration>): Promise<Result<Device>>;
  deleteDevice(id: string): Promise<void>;
  getNotifications(deviceId: string): Promise<Result<NotificationHistoryEntry[]>>;
  sendTestNotification(deviceId: string): Promise<Result<NotificationMessage>>;
}

function readEnvBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  return url && url.length > 0 ? url.replace(/\/+$/, '') : DEFAULT_BASE_URL;
}

export function envUseFixtures(): boolean {
  const v = process.env.EXPO_PUBLIC_USE_FIXTURES;
  return v === '1' || v === 'true';
}

function isApiError(x: unknown): x is ApiError {
  return (
    !!x &&
    typeof x === 'object' &&
    'error' in x &&
    !!(x as ApiError).error &&
    typeof (x as ApiError).error.code === 'string'
  );
}

function isEnvelope(x: unknown): x is ApiResponse<unknown> {
  return !!x && typeof x === 'object' && 'data' in x && 'meta' in x;
}

const qs = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

export function createClient(options: ClientOptions = {}): ApiClient {
  const baseUrl = (options.baseUrl ?? readEnvBaseUrl()).replace(/\/+$/, '');
  const useFixtures = options.useFixtures ?? envUseFixtures();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const fetchFn: typeof fetch =
    options.fetchFn ??
    ((input, init) => {
      if (typeof fetch !== 'function') throw new Error('fetch is not available');
      return fetch(input, init);
    });

  async function requestFixture<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
    // Lazy import keeps fixtures out of the hot path when not in fixture mode.
    const { handleFixtureRequest } = await import('@/__fixtures__/handler');
    const res = handleFixtureRequest(method, path, body);
    if (res.status === 204 || res.body === null) {
      return { data: undefined as T, meta: { provider: 'fixture', fetchedAt: '', stale: false, mock: true } };
    }
    if (isApiError(res.body)) throw new ApiClientError(res.body.error.code, res.body.error.message, res.status);
    return { data: res.body.data as T, meta: res.body.meta };
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<Result<T>> {
    if (useFixtures) return requestFixture<T>(method, path, body);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    let res: Response;
    try {
      res = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller?.signal,
      });
    } catch (err) {
      throw new ApiClientError('NETWORK', err instanceof Error ? err.message : 'Network request failed', 0);
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (res.status === 204) {
      return { data: undefined as T, meta: { provider: 'none', fetchedAt: '', stale: false, mock: false } };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      if (!res.ok) throw new ApiClientError('INTERNAL', `HTTP ${res.status}`, res.status);
      throw new ApiClientError('PARSE', 'Response was not valid JSON', res.status);
    }

    if (!res.ok) {
      if (isApiError(json)) throw new ApiClientError(json.error.code, json.error.message, res.status);
      throw new ApiClientError('INTERNAL', `HTTP ${res.status}`, res.status);
    }
    if (!isEnvelope(json)) throw new ApiClientError('PARSE', 'Response missing {data, meta} envelope', res.status);
    return { data: json.data as T, meta: json.meta };
  }

  return {
    baseUrl,
    useFixtures,
    request,
    getWeather: (c) => request<TodayWeather>('GET', `/weather?${qs({ lat: c.lat, lon: c.lon })}`),
    getAir: (c) => request<AirQualityReport>('GET', `/air?${qs({ lat: c.lat, lon: c.lon })}`),
    getPredict: (c, hours = 72) => request<AiPrediction>('GET', `/predict?${qs({ lat: c.lat, lon: c.lon, hours })}`),
    getRegions: () => request<Region[]>('GET', '/regions'),
    getRegionAlerts: (id) => request<RegionAlerts>('GET', `/regions/${encodeURIComponent(id)}/alerts`),
    registerDevice: (reg) => request<Device>('POST', '/devices', reg),
    getDevice: (id) => request<Device>('GET', `/devices/${encodeURIComponent(id)}`),
    patchDevice: (id, patch) => request<Device>('PATCH', `/devices/${encodeURIComponent(id)}`, patch),
    deleteDevice: async (id) => {
      await request<void>('DELETE', `/devices/${encodeURIComponent(id)}`);
    },
    getNotifications: (id) =>
      request<NotificationHistoryEntry[]>('GET', `/devices/${encodeURIComponent(id)}/notifications`),
    sendTestNotification: (id) =>
      request<NotificationMessage>('POST', `/devices/${encodeURIComponent(id)}/test-notification`),
  };
}

/** App-wide singleton configured from env. */
export const api: ApiClient = createClient();

/** Friendly message for UI error states. */
export function describeError(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiClientError) {
    switch (err.code) {
      case 'NETWORK':
        return 'Cannot reach the Skycast server.';
      case 'UPSTREAM_UNAVAILABLE':
        return 'Weather provider unavailable, try again shortly.';
      case 'RATE_LIMITED':
        return 'Too many requests, slow down a little.';
      case 'NOT_FOUND':
        return err.message || 'Not found.';
      default:
        return err.message || fallback;
    }
  }
  return err instanceof Error ? err.message : fallback;
}
