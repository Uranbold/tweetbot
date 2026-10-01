import { QueryClient, useQuery } from '@tanstack/react-query';
import type {
  AiPrediction,
  AirQualityReport,
  ForecastComparison,
  Location,
  ModelId,
  NationSnapshot,
  TodayWeather,
} from '@contract';
import { ApiRequestError, apiGet } from './client';

const MINUTE = 60_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * MINUTE,
        gcTime: 30 * MINUTE,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError && !error.retryable) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  });
}

/** Coordinates in cache keys are rounded so 47.9200 and 47.92 share an entry. */
const c = (n: number) => n.toFixed(2);

export const queryKeys = {
  weather: (lat: number, lon: number) => ['weather', c(lat), c(lon)] as const,
  air: (lat: number, lon: number) => ['air', c(lat), c(lon)] as const,
  compare: (lat: number, lon: number, models: readonly ModelId[]) => ['compare', c(lat), c(lon), [...models].sort().join(',')] as const,
  nation: (region: string) => ['nation', region] as const,
  search: (q: string) => ['locations', 'search', q.trim().toLowerCase()] as const,
  reverse: (lat: number, lon: number) => ['locations', 'reverse', c(lat), c(lon)] as const,
  predict: (lat: number, lon: number, hours: number) => ['predict', c(lat), c(lon), hours] as const,
};

export function useWeather(lat: number, lon: number) {
  return useQuery({
    queryKey: queryKeys.weather(lat, lon),
    queryFn: ({ signal }) => apiGet<TodayWeather>('/weather', { lat: c(lat), lon: c(lon) }, signal),
  });
}

export function useAir(lat: number, lon: number) {
  return useQuery({
    queryKey: queryKeys.air(lat, lon),
    queryFn: ({ signal }) => apiGet<AirQualityReport>('/air', { lat: c(lat), lon: c(lon) }, signal),
  });
}

export function useCompare(lat: number, lon: number, models: readonly ModelId[]) {
  return useQuery({
    queryKey: queryKeys.compare(lat, lon, models),
    queryFn: ({ signal }) =>
      apiGet<ForecastComparison>('/compare', { lat: c(lat), lon: c(lon), models: models.join(',') }, signal),
    enabled: models.length > 0,
    placeholderData: (prev) => prev,
  });
}

export function useNation(region: string) {
  return useQuery({
    queryKey: queryKeys.nation(region),
    queryFn: ({ signal }) => apiGet<NationSnapshot>('/nation', { region }, signal),
    staleTime: 10 * MINUTE,
  });
}

export function useLocationSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.search(term),
    queryFn: ({ signal }) => apiGet<Location[]>('/locations/search', { q: term.slice(0, 100), limit: 8 }, signal),
    enabled: term.length >= 1,
    staleTime: 60 * MINUTE,
    placeholderData: (prev) => prev,
    retry: false,
  });
}

export function fetchReverse(client: QueryClient, lat: number, lon: number) {
  return client.fetchQuery({
    queryKey: queryKeys.reverse(lat, lon),
    queryFn: ({ signal }) => apiGet<Location>('/locations/reverse', { lat: c(lat), lon: c(lon) }, signal),
    staleTime: 60 * MINUTE,
  });
}

/**
 * AI post-processed forecast. Kept separate from /weather so an AI-service outage (503) only
 * affects its own card; it is retried once, not on 503 storms.
 */
export function usePredict(lat: number, lon: number, hours = 72) {
  return useQuery({
    queryKey: queryKeys.predict(lat, lon, hours),
    queryFn: ({ signal }) => apiGet<AiPrediction>('/predict', { lat: c(lat), lon: c(lon), hours }, signal),
    staleTime: 15 * MINUTE,
    retry: (failureCount, error) => {
      if (error instanceof ApiRequestError && (error.code === 'UPSTREAM_UNAVAILABLE' || !error.retryable)) return false;
      return failureCount < 1;
    },
  });
}
