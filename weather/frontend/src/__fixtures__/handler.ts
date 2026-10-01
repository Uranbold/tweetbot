/**
 * Fixture-backed implementation of the API used by tests and by `VITE_USE_FIXTURES=1` dev/preview
 * builds. Never imported by production code paths (guarded by the compile-time __USE_FIXTURES__).
 */
import type {
  AirQualityReport,
  ApiResponse,
  ForecastComparison,
  Location,
  NationSnapshot,
  TodayWeather,
} from '@contract';
import type { QueryParams } from '../api/client';
import { ApiRequestError } from '../api/client';
import weatherJson from './weather.json';
import airJson from './air.json';
import compareJson from './compare.json';
import nationMn from './nation-mn.json';
import nationKr from './nation-kr.json';
import nationWorld from './nation-world.json';
import locationsJson from './locations.json';
import regionsJson from './regions.json';

export const fixtures = {
  weather: weatherJson as ApiResponse<TodayWeather>,
  air: airJson as ApiResponse<AirQualityReport>,
  compare: compareJson as ApiResponse<ForecastComparison>,
  nation: {
    mn: nationMn as ApiResponse<NationSnapshot>,
    kr: nationKr as ApiResponse<NationSnapshot>,
    world: nationWorld as ApiResponse<NationSnapshot>,
  } as Record<string, ApiResponse<NationSnapshot>>,
  locations: locationsJson as ApiResponse<Location[]>,
  regions: regionsJson as ApiResponse<{ id: string; label: string }[]>,
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const allCities = () => Object.values(fixtures.nation).flatMap((n) => n.data.cities);

function nearestLocation(lat: number, lon: number): Location {
  let best: Location | null = null;
  let bestD = Infinity;
  for (const l of fixtures.locations.data) {
    const d = (l.lat - lat) ** 2 + (l.lon - lon) ** 2;
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  if (best && bestD < 0.5) return best;
  const base = fixtures.weather.data.location;
  return {
    id: `${lat.toFixed(2)},${lon.toFixed(2)}`,
    name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    country: '',
    countryCode: '',
    lat,
    lon,
    timezone: base.timezone,
    utcOffsetSeconds: base.utcOffsetSeconds,
  };
}

/** Temperature offset so other cities look plausibly different from the Ulaanbaatar baseline. */
function tempShift(location: Location): number {
  const city = allCities().find((c) => c.location.id === location.id);
  const base = fixtures.weather.data.current.temperature;
  return city ? Math.round((city.temperature - base) * 10) / 10 : 0;
}

const shiftT = (n: number, s: number) => Math.round((n + s) * 10) / 10;

function coords(params: QueryParams): { lat: number; lon: number } {
  const lat = Number(params.lat);
  const lon = Number(params.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new ApiRequestError('lat must be in [-90, 90] and lon in [-180, 180]', 400, 'BAD_REQUEST');
  }
  return { lat, lon };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

function resolveFixture(path: string, params: QueryParams): ApiResponse<unknown> {
  switch (path) {
    case '/locations/search': {
      const q = fold(String(params.q ?? '').trim());
      if (!q) throw new ApiRequestError('q must be 1..100 characters', 400, 'BAD_REQUEST');
      const limit = Number(params.limit ?? 8);
      const data = fixtures.locations.data
        .filter((l) => fold(l.name).includes(q) || fold(l.country).startsWith(q))
        .sort((a, b) => Number(!fold(a.name).startsWith(q)) - Number(!fold(b.name).startsWith(q)))
        .slice(0, limit);
      return { ...fixtures.locations, data };
    }
    case '/locations/reverse': {
      const { lat, lon } = coords(params);
      return { ...fixtures.locations, data: nearestLocation(lat, lon) };
    }
    case '/weather': {
      const { lat, lon } = coords(params);
      const res = clone(fixtures.weather);
      const location = nearestLocation(lat, lon);
      const s = tempShift(location);
      const d = res.data;
      d.location = location;
      d.current.temperature = shiftT(d.current.temperature, s);
      d.current.feelsLike = shiftT(d.current.feelsLike, s);
      d.today.temperatureMin = shiftT(d.today.temperatureMin, s);
      d.today.temperatureMax = shiftT(d.today.temperatureMax, s);
      d.hourly.forEach((h) => {
        h.temperature = shiftT(h.temperature, s);
        h.feelsLike = shiftT(h.feelsLike, s);
      });
      d.daily.forEach((x) => {
        x.temperatureMin = shiftT(x.temperatureMin, s);
        x.temperatureMax = shiftT(x.temperatureMax, s);
      });
      return res;
    }
    case '/air': {
      const { lat, lon } = coords(params);
      const res = clone(fixtures.air);
      res.data.location = nearestLocation(lat, lon);
      return res;
    }
    case '/compare': {
      const { lat, lon } = coords(params);
      const res = clone(fixtures.compare);
      const wanted = String(params.models ?? '')
        .split(',')
        .filter(Boolean);
      const location = nearestLocation(lat, lon);
      const s = tempShift(location);
      res.data.location = location;
      if (wanted.length) res.data.models = res.data.models.filter((m) => wanted.includes(m.model));
      res.data.models.forEach((m) => {
        m.hourly.forEach((h) => (h.temperature = shiftT(h.temperature, s)));
        m.daily.forEach((x) => {
          x.temperatureMin = shiftT(x.temperatureMin, s);
          x.temperatureMax = shiftT(x.temperatureMax, s);
        });
      });
      res.data.consensus.forEach((x) => (x.temperatureMaxMean = shiftT(x.temperatureMaxMean, s)));
      return res;
    }
    case '/nation': {
      const region = String(params.region ?? 'mn');
      const res = fixtures.nation[region];
      if (!res) throw new ApiRequestError(`Unknown region "${region}"`, 404, 'NOT_FOUND');
      return clone(res);
    }
    case '/regions':
      return clone(fixtures.regions);
    default:
      throw new ApiRequestError(`No fixture for ${path}`, 404, 'NOT_FOUND');
  }
}

export async function fixtureResponse<T>(path: string, params: QueryParams, signal?: AbortSignal, latencyMs = 150): Promise<ApiResponse<T>> {
  if (latencyMs > 0) await delay(latencyMs, signal);
  return resolveFixture(path, params) as ApiResponse<T>;
}

/** A `fetch` replacement that serves fixtures for `/api/v1/*` URLs (used in tests). */
export function createFixtureFetch(latencyMs = 0): typeof fetch {
  return async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const params = Object.fromEntries(url.searchParams.entries());
    try {
      const body = await fixtureResponse(path, params, undefined, latencyMs);
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      const e = err as ApiRequestError;
      return new Response(JSON.stringify({ error: { code: e.code, message: e.message } }), {
        status: e.status || 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}
