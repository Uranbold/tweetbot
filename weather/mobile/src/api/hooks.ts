import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { AiPrediction, Device, NotificationHistoryEntry, NotificationMessage, Region, TodayWeather } from '@contract';
import { api, type Coords, type RegionAlerts, type Result } from './client';

export const queryKeys = {
  weather: (c: Coords) => ['weather', round(c.lat), round(c.lon)] as const,
  predict: (c: Coords) => ['predict', round(c.lat), round(c.lon)] as const,
  regions: ['regions'] as const,
  regionAlerts: (id: string) => ['region-alerts', id] as const,
  notifications: (deviceId: string) => ['notifications', deviceId] as const,
  device: (deviceId: string) => ['device', deviceId] as const,
};

const round = (n: number) => Math.round(n * 100) / 100;

type Opts<T> = Omit<UseQueryOptions<Result<T>, Error>, 'queryKey' | 'queryFn'>;

export function useWeather(coords: Coords | null, opts?: Opts<TodayWeather>) {
  return useQuery<Result<TodayWeather>, Error>({
    queryKey: coords ? queryKeys.weather(coords) : ['weather', 'none'],
    queryFn: () => api.getWeather(coords as Coords),
    enabled: !!coords,
    staleTime: 10 * 60_000,
    ...opts,
  });
}

export function usePredict(coords: Coords | null, opts?: Opts<AiPrediction>) {
  return useQuery<Result<AiPrediction>, Error>({
    queryKey: coords ? queryKeys.predict(coords) : ['predict', 'none'],
    queryFn: () => api.getPredict(coords as Coords),
    enabled: !!coords,
    staleTime: 30 * 60_000,
    ...opts,
  });
}

export function useRegions(opts?: Opts<Region[]>) {
  return useQuery<Result<Region[]>, Error>({
    queryKey: queryKeys.regions,
    queryFn: () => api.getRegions(),
    staleTime: 24 * 60 * 60_000,
    ...opts,
  });
}

export function useRegionAlerts(regionId: string | null, opts?: Opts<RegionAlerts>) {
  return useQuery<Result<RegionAlerts>, Error>({
    queryKey: regionId ? queryKeys.regionAlerts(regionId) : ['region-alerts', 'none'],
    queryFn: () => api.getRegionAlerts(regionId as string),
    enabled: !!regionId,
    staleTime: 5 * 60_000,
    ...opts,
  });
}

export function useNotificationHistory(deviceId: string | null, opts?: Opts<NotificationHistoryEntry[]>) {
  return useQuery<Result<NotificationHistoryEntry[]>, Error>({
    queryKey: deviceId ? queryKeys.notifications(deviceId) : ['notifications', 'none'],
    queryFn: () => api.getNotifications(deviceId as string),
    enabled: !!deviceId,
    staleTime: 60_000,
    ...opts,
  });
}

export function useDevice(deviceId: string | null, opts?: Opts<Device>) {
  return useQuery<Result<Device>, Error>({
    queryKey: deviceId ? queryKeys.device(deviceId) : ['device', 'none'],
    queryFn: () => api.getDevice(deviceId as string),
    enabled: !!deviceId,
    ...opts,
  });
}

export function useSendTestNotification(deviceId: string | null) {
  const qc = useQueryClient();
  return useMutation<Result<NotificationMessage>, Error>({
    mutationFn: () => {
      if (!deviceId) throw new Error('Device is not registered yet');
      return api.sendTestNotification(deviceId);
    },
    onSuccess: () => {
      if (deviceId) void qc.invalidateQueries({ queryKey: queryKeys.notifications(deviceId) });
    },
  });
}
