import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Device, DeviceRegistration, NotificationPreferences } from '@contract';
import { api, describeError } from '@/api/client';
import { loadPersistedState, savePersistedState } from './persistence';
import {
  initialState,
  needsSync,
  reducer,
  toPersisted,
  toRegistration,
  type Action,
  type DeviceState,
  type PermissionStatus,
} from './reducer';

export interface DeviceStoreValue {
  state: DeviceState;
  dispatch: React.Dispatch<Action>;
  toggleRegion: (regionId: string) => void;
  setFollowLocation: (enabled: boolean) => void;
  setLastLocation: (loc: { lat: number; lon: number } | undefined) => void;
  updatePreferences: (patch: Partial<NotificationPreferences>) => void;
  setPushToken: (token: string) => void;
  setPermission: (status: PermissionStatus) => void;
  /** Force an immediate sync (skips the debounce). */
  syncNow: () => Promise<Device | null>;
}

const DeviceStoreContext = createContext<DeviceStoreValue | null>(null);

export const SYNC_DEBOUNCE_MS = 800;

function detectPlatform(): DeviceRegistration['platform'] {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

export interface DeviceProviderProps {
  children: React.ReactNode;
  /** Test hook: start from this state instead of hydrating from storage. */
  initialStateOverride?: Partial<DeviceState>;
  /** Test hook: disable storage + network side effects. */
  disableEffects?: boolean;
}

export function DeviceProvider({ children, initialStateOverride, disableEffects = false }: DeviceProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState, (s) =>
    initialStateOverride ? { ...s, ...initialStateOverride, hydrated: true } : s,
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<Device | null> | null>(null);

  // 1. Hydrate from AsyncStorage once, then record platform/app version.
  useEffect(() => {
    if (disableEffects || initialStateOverride) return;
    let cancelled = false;
    void loadPersistedState().then((persisted) => {
      if (cancelled) return;
      dispatch({ type: 'HYDRATE', payload: persisted });
      dispatch({
        type: 'SET_PLATFORM',
        platform: detectPlatform(),
        appVersion: Constants.expoConfig?.version ?? undefined,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [disableEffects, initialStateOverride]);

  // 2. Persist whenever persisted fields change.
  useEffect(() => {
    if (disableEffects || !state.hydrated) return;
    void savePersistedState(toPersisted(state));
  }, [
    disableEffects,
    state.hydrated,
    state.deviceId,
    state.pushToken,
    state.platform,
    state.regionIds,
    state.followLocation,
    state.lastLocation,
    state.preferences,
    state.appVersion,
    state.lastSynced,
  ]);

  const syncNow = useCallback(async (): Promise<Device | null> => {
    if (inFlightRef.current) return inFlightRef.current;
    const run = (async () => {
      const s = stateRef.current;
      if (!s.pushToken) return null;
      dispatch({ type: 'SYNC_STARTED' });
      try {
        const reg = toRegistration(s);
        const res = s.deviceId
          ? await api.patchDevice(s.deviceId, reg).catch(async (err: unknown) => {
              // Device vanished server-side (e.g. backend restarted with in-memory storage): re-register.
              if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
                return api.registerDevice(reg);
              }
              throw err;
            })
          : await api.registerDevice(reg);
        dispatch({ type: 'SYNC_SUCCEEDED', device: res.data });
        return res.data;
      } catch (err) {
        dispatch({ type: 'SYNC_FAILED', error: describeError(err) });
        return null;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = run;
    return run;
  }, []);

  // 3. Debounced sync on every dirty change (and on start-up when registration drifted).
  useEffect(() => {
    if (disableEffects || !state.hydrated) return;
    if (!needsSync(state)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void syncNow();
    }, SYNC_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disableEffects, state.hydrated, state.dirtyVersion, state.pushToken, syncNow]);

  const value = useMemo<DeviceStoreValue>(
    () => ({
      state,
      dispatch,
      toggleRegion: (regionId) => dispatch({ type: 'TOGGLE_REGION', regionId }),
      setFollowLocation: (enabled) => dispatch({ type: 'SET_FOLLOW_LOCATION', enabled }),
      setLastLocation: (location) => dispatch({ type: 'SET_LAST_LOCATION', location }),
      updatePreferences: (patch) => dispatch({ type: 'UPDATE_PREFERENCES', patch }),
      setPushToken: (token) => dispatch({ type: 'SET_PUSH_TOKEN', token }),
      setPermission: (status) => dispatch({ type: 'SET_PERMISSION', status }),
      syncNow,
    }),
    [state, syncNow],
  );

  return <DeviceStoreContext.Provider value={value}>{children}</DeviceStoreContext.Provider>;
}

export function useDeviceStore(): DeviceStoreValue {
  const ctx = useContext(DeviceStoreContext);
  if (!ctx) throw new Error('useDeviceStore must be used inside <DeviceProvider>');
  return ctx;
}
