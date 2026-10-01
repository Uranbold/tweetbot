/**
 * Composition root: wires adapters → ports → services according to config.
 * Tests pass `overrides` to swap any adapter (e.g. a live provider that throws 429).
 */
import type { Config } from './config.js';
import type { Cache } from './cache/cache.js';
import { MemoryLruCache } from './cache/memory.js';
import { ReadThroughCache } from './cache/readThrough.js';
import { Dispatcher } from './notifications/dispatcher.js';
import { DeviceService } from './notifications/deviceService.js';
import { ExpoPushSender, LogPushSender, type PushSender } from './notifications/push.js';
import {
  InMemoryDeviceRepository, InMemoryNotificationHistoryRepository, type DeviceRepository, type NotificationHistoryRepository,
} from './notifications/repositories.js';
import { FallbackPolicy, withFallback, type FallbackStats } from './providers/fallback.js';
import { MockAirProvider, MockGeocodingProvider, MockModelProvider, MockWeatherProvider } from './providers/mock/adapters.js';
import {
  OpenMeteoAirProvider, OpenMeteoGeocodingProvider, OpenMeteoModelProvider, OpenMeteoWeatherProvider, type OpenMeteoOptions,
} from './providers/openmeteo/adapters.js';
import type { FetchLike } from './providers/openmeteo/http.js';
import type { Providers } from './providers/ports.js';
import type { CachePolicy } from './services/common.js';
import { LocationService } from './services/locationService.js';
import { HttpAiPredictionProvider, PredictService, type AiPredictionProvider } from './services/predictService.js';
import { RegionAlertsService } from './services/regionAlertsService.js';
import { RegionService } from './services/regionService.js';
import { AirService, CompareService, NationService, WeatherService, type Logger } from './services/weatherService.js';

export interface ContainerLogger extends Logger {
  info(obj: object, msg?: string): void;
}

export interface Overrides {
  live?: Partial<Providers>;
  mock?: Partial<Providers>;
  cache?: Cache;
  ai?: AiPredictionProvider;
  push?: PushSender;
  devices?: DeviceRepository;
  history?: NotificationHistoryRepository;
  /** fetch used by the Open-Meteo / AI / Expo adapters. */
  fetch?: FetchLike;
  clock?: () => Date;
  log?: ContainerLogger;
}

export interface Container {
  config: Config;
  providers: Providers;
  cache: ReadThroughCache;
  fallback: { forecast: FallbackPolicy; air: FallbackPolicy; geocoding: FallbackPolicy } | null;
  services: {
    locations: LocationService;
    weather: WeatherService;
    air: AirService;
    compare: CompareService;
    nation: NationService;
    regions: RegionService;
    predict: PredictService;
    regionAlerts: RegionAlertsService;
    devices: DeviceService;
  };
  notifications: {
    devices: DeviceRepository;
    history: NotificationHistoryRepository;
    push: PushSender;
    dispatcher: Dispatcher;
  };
  providerLabel: string;
  startedAt: number;
  fallbackStats(): Record<string, FallbackStats> | null;
}

const nullLog: ContainerLogger = { info: () => {}, warn: () => {} };

export function createContainer(config: Config, overrides: Overrides = {}): Container {
  const clock = overrides.clock ?? (() => new Date());
  const log = overrides.log ?? nullLog;
  const omOpts: OpenMeteoOptions = { timeoutMs: config.UPSTREAM_TIMEOUT_MS, now: clock };
  if (overrides.fetch) omOpts.fetch = overrides.fetch;

  const live: Providers = {
    weather: new OpenMeteoWeatherProvider(omOpts),
    air: new OpenMeteoAirProvider(omOpts),
    geocoding: new OpenMeteoGeocodingProvider(omOpts),
    models: new OpenMeteoModelProvider(omOpts),
    ...overrides.live,
  };
  const mock: Providers = {
    weather: new MockWeatherProvider({ now: clock }),
    air: new MockAirProvider({ now: clock }),
    geocoding: new MockGeocodingProvider({ now: clock }),
    models: new MockModelProvider({ now: clock }),
    ...overrides.mock,
  };

  let providers: Providers;
  let fallback: Container['fallback'] = null;
  if (config.PROVIDER_MODE === 'live') providers = live;
  else if (config.PROVIDER_MODE === 'mock') providers = mock;
  else {
    const onFallback = (e: { port: string; error: unknown }) =>
      log.warn({ port: e.port, err: (e.error as Error).message }, 'upstream failed; serving mock fallback');
    const policy = () => new FallbackPolicy(config.UPSTREAM_COOLDOWN_MS, onFallback, () => clock().getTime());
    fallback = { forecast: policy(), air: policy(), geocoding: policy() };
    providers = withFallback(live, mock, fallback);
  }

  const store = overrides.cache ?? new MemoryLruCache(config.CACHE_MAX_ENTRIES, () => clock().getTime());
  const cache = new ReadThroughCache(store, config.CACHE_STALE_TTL, () => clock().getTime());
  const auto = config.PROVIDER_MODE === 'auto';
  const policy = (ttlSeconds: number): CachePolicy => ({ ttlSeconds, autoFallback: auto, mockTtlSeconds: config.CACHE_TTL_MOCK_FALLBACK });

  const locations = new LocationService(providers.geocoding, cache, policy(config.CACHE_TTL_GEOCODE), clock);
  const weather = new WeatherService(providers.weather, providers.air, locations, cache, policy(config.CACHE_TTL_WEATHER), log);
  const regions = new RegionService();
  const ai = overrides.ai ?? new HttpAiPredictionProvider(config.AI_SERVICE_URL, config.UPSTREAM_TIMEOUT_MS, overrides.fetch);
  const predict = new PredictService(ai, cache, config.CACHE_TTL_PREDICT);
  const regionAlerts = new RegionAlertsService(weather, predict);

  const devices = overrides.devices ?? new InMemoryDeviceRepository();
  const history = overrides.history ?? new InMemoryNotificationHistoryRepository();
  const pushOpts: ConstructorParameters<typeof ExpoPushSender>[0] = { timeoutMs: config.UPSTREAM_TIMEOUT_MS };
  if (config.EXPO_ACCESS_TOKEN) pushOpts.accessToken = config.EXPO_ACCESS_TOKEN;
  if (overrides.fetch) pushOpts.fetch = overrides.fetch;
  const push = overrides.push ?? (config.PUSH_MODE === 'expo' ? new ExpoPushSender(pushOpts) : new LogPushSender(log));
  const dispatcher = new Dispatcher({ devices, history, push, regions, conditions: (r) => regionAlerts.conditions(r), log });

  const providerLabel = config.PROVIDER_MODE === 'auto' ? `auto (${live.weather.name} → ${mock.weather.name})` : `${config.PROVIDER_MODE} (${providers.weather.name})`;

  return {
    config,
    providers,
    cache,
    fallback,
    services: {
      locations,
      weather,
      air: new AirService(providers.air, locations, cache, policy(config.CACHE_TTL_AIR)),
      compare: new CompareService(providers.models, locations, cache, policy(config.CACHE_TTL_COMPARE), clock),
      nation: new NationService(providers.weather, providers.air, cache, policy(config.CACHE_TTL_NATION), clock, log),
      regions,
      predict,
      regionAlerts,
      devices: new DeviceService(devices, history, push, regions, clock),
    },
    notifications: { devices, history, push, dispatcher },
    providerLabel,
    startedAt: clock().getTime(),
    fallbackStats: () =>
      fallback ? { forecast: fallback.forecast.snapshot(), air: fallback.air.snapshot(), geocoding: fallback.geocoding.snapshot() } : null,
  };
}
