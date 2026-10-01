import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Region } from '@contract';
import { useRegions } from '@/api/hooks';
import { useT } from '@/i18n';
import { DEFAULT_COORDS, nearestRegion } from '@/lib/geo';
import { useDeviceStore } from '@/store/DeviceProvider';

export interface ActiveLocation {
  lat: number;
  lon: number;
  /** Display label for the header. */
  label: string;
  /** Region id when the active location is a subscribed region. */
  regionId: string | null;
  source: 'gps' | 'region' | 'default';
  regions: Region[];
}

/**
 * The place the Today / AI tabs show: GPS position when "Follow my location" is on and we have a fix,
 * else the first subscribed region, else Ulaanbaatar.
 */
export function useActiveLocation(): ActiveLocation {
  const { state } = useDeviceStore();
  const regionsQuery = useRegions();
  const t = useT();
  const regions = regionsQuery.data?.data ?? [];

  return useMemo(() => {
    if (state.followLocation && state.lastLocation) {
      const near = nearestRegion(regions, state.lastLocation.lat, state.lastLocation.lon);
      return {
        lat: state.lastLocation.lat,
        lon: state.lastLocation.lon,
        label: near ? `${t.gpsLabel} · ${near.name}` : t.gpsLabel,
        regionId: near?.id ?? null,
        source: 'gps',
        regions,
      };
    }
    const firstId = state.regionIds[0];
    const region = firstId ? regions.find((r) => r.id === firstId) : undefined;
    if (region) {
      return { lat: region.lat, lon: region.lon, label: region.name, regionId: region.id, source: 'region', regions };
    }
    return { ...DEFAULT_COORDS, label: DEFAULT_COORDS.name, regionId: null, source: 'default', regions };
  }, [state.followLocation, state.lastLocation, state.regionIds, regions, t.gpsLabel]);
}

/**
 * Foreground-only GPS: when followLocation is on, request permission and store one fix per app session
 * (and again whenever the toggle is switched on). Background location is intentionally not requested.
 */
export function useGpsFollow(): { requestFix: () => Promise<boolean> } {
  const { state, setLastLocation, setFollowLocation } = useDeviceStore();
  const lastRunRef = useRef(false);

  const requestFix = async (): Promise<boolean> => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return false;
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      setLastLocation({ lat: round4(pos.coords.latitude), lon: round4(pos.coords.longitude) });
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!state.hydrated) return;
    if (!state.followLocation) {
      lastRunRef.current = false;
      return;
    }
    if (lastRunRef.current) return;
    lastRunRef.current = true;
    void requestFix().then((ok) => {
      // On web without permission we still keep the toggle; on native a denial switches it off so the
      // registration does not claim followLocation without a position.
      if (!ok && Platform.OS !== 'web') setFollowLocation(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated, state.followLocation]);

  return { requestFix };
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;
