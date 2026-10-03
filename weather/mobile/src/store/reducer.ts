import type { AlertType, Device, DeviceRegistration, NotificationPreferences, Platform } from '@contract';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';
export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error';

export const ALL_ALERT_TYPES: AlertType[] = [
  'heat-wave',
  'cold-wave',
  'heavy-rain',
  'heavy-snow',
  'strong-wind',
  'dry',
  'fine-dust',
  'typhoon',
];

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  alertTypes: [...ALL_ALERT_TYPES],
  minSeverity: 'advisory',
  aiRiskThreshold: 0.6,
  dailyBriefingHour: null,
  airGradeThreshold: 'bad',
  quietHours: null,
  locale: 'en',
};

export interface DeviceState {
  /** Server-assigned id once POST /devices succeeded. */
  deviceId: string | null;
  pushToken: string | null;
  platform: Platform;
  regionIds: string[];
  followLocation: boolean;
  lastLocation?: { lat: number; lon: number };
  preferences: NotificationPreferences;
  appVersion?: string;
  /** OS notification permission, tracked for the Settings status row. */
  notificationPermission: PermissionStatus;
  /** True after AsyncStorage was read (even if empty). */
  hydrated: boolean;
  /** Registration payload last acknowledged by the server, for change detection on app start. */
  lastSynced: DeviceRegistration | null;
  syncStatus: SyncStatus;
  syncError?: string;
  /** Monotonic counter bumped by every change that needs a server sync. */
  dirtyVersion: number;
  /** When a test notification was last sent successfully (setup progress, UX §4.9). */
  testSentAt: string | null;
}

export const initialState: DeviceState = {
  deviceId: null,
  pushToken: null,
  platform: 'android',
  regionIds: [],
  followLocation: false,
  preferences: DEFAULT_PREFERENCES,
  notificationPermission: 'undetermined',
  hydrated: false,
  lastSynced: null,
  syncStatus: 'idle',
  dirtyVersion: 0,
  testSentAt: null,
};

/** Subset of state that is persisted to AsyncStorage. */
export type PersistedState = Pick<
  DeviceState,
  'deviceId' | 'pushToken' | 'platform' | 'regionIds' | 'followLocation' | 'lastLocation' | 'preferences' | 'appVersion' | 'lastSynced' | 'testSentAt'
>;

export type Action =
  | { type: 'HYDRATE'; payload: Partial<PersistedState> | null }
  | { type: 'SET_PLATFORM'; platform: Platform; appVersion?: string }
  | { type: 'SET_PUSH_TOKEN'; token: string }
  | { type: 'SET_PERMISSION'; status: PermissionStatus }
  | { type: 'TOGGLE_REGION'; regionId: string }
  | { type: 'SET_REGIONS'; regionIds: string[] }
  | { type: 'SET_FOLLOW_LOCATION'; enabled: boolean }
  | { type: 'SET_LAST_LOCATION'; location: { lat: number; lon: number } | undefined }
  | { type: 'UPDATE_PREFERENCES'; patch: Partial<NotificationPreferences> }
  | { type: 'SYNC_STARTED' }
  | { type: 'SYNC_SUCCEEDED'; device: Device }
  | { type: 'SYNC_FAILED'; error: string }
  | { type: 'TEST_SENT'; at: string }
  | { type: 'RESET' };

const dirty = (s: DeviceState): DeviceState => ({ ...s, dirtyVersion: s.dirtyVersion + 1, syncStatus: 'pending' });

export function reducer(state: DeviceState, action: Action): DeviceState {
  switch (action.type) {
    case 'HYDRATE': {
      const p = action.payload ?? {};
      return {
        ...state,
        deviceId: p.deviceId ?? state.deviceId,
        pushToken: p.pushToken ?? state.pushToken,
        platform: p.platform ?? state.platform,
        regionIds: p.regionIds ?? state.regionIds,
        followLocation: p.followLocation ?? state.followLocation,
        lastLocation: p.lastLocation ?? state.lastLocation,
        preferences: { ...DEFAULT_PREFERENCES, ...(p.preferences ?? {}) },
        appVersion: p.appVersion ?? state.appVersion,
        lastSynced: p.lastSynced ?? null,
        testSentAt: p.testSentAt ?? null,
        hydrated: true,
      };
    }
    case 'SET_PLATFORM':
      if (state.platform === action.platform && state.appVersion === action.appVersion) return state;
      return { ...state, platform: action.platform, appVersion: action.appVersion };
    case 'SET_PUSH_TOKEN':
      if (state.pushToken === action.token) return state;
      return dirty({ ...state, pushToken: action.token });
    case 'SET_PERMISSION':
      if (state.notificationPermission === action.status) return state;
      return { ...state, notificationPermission: action.status };
    case 'TOGGLE_REGION': {
      const has = state.regionIds.includes(action.regionId);
      const regionIds = has ? state.regionIds.filter((r) => r !== action.regionId) : [...state.regionIds, action.regionId];
      return dirty({ ...state, regionIds });
    }
    case 'SET_REGIONS':
      return dirty({ ...state, regionIds: [...new Set(action.regionIds)] });
    case 'SET_FOLLOW_LOCATION':
      if (state.followLocation === action.enabled) return state;
      return dirty({ ...state, followLocation: action.enabled });
    case 'SET_LAST_LOCATION': {
      const prev = state.lastLocation;
      const next = action.location;
      if (prev?.lat === next?.lat && prev?.lon === next?.lon) return state;
      return dirty({ ...state, lastLocation: next });
    }
    case 'UPDATE_PREFERENCES':
      return dirty({ ...state, preferences: { ...state.preferences, ...action.patch } });
    case 'SYNC_STARTED':
      return { ...state, syncStatus: 'syncing', syncError: undefined };
    case 'SYNC_SUCCEEDED':
      return {
        ...state,
        deviceId: action.device.id,
        lastSynced: toRegistration(state),
        syncStatus: 'synced',
        syncError: undefined,
      };
    case 'SYNC_FAILED':
      return { ...state, syncStatus: 'error', syncError: action.error };
    case 'TEST_SENT':
      return { ...state, testSentAt: action.at };
    case 'RESET':
      return { ...initialState, hydrated: true, platform: state.platform, appVersion: state.appVersion };
    default:
      return state;
  }
}

/** The exact DeviceRegistration body we send to POST /devices. Requires a push token. */
export function toRegistration(state: Pick<DeviceState, 'pushToken' | 'platform' | 'regionIds' | 'followLocation' | 'lastLocation' | 'preferences' | 'appVersion'>): DeviceRegistration {
  const reg: DeviceRegistration = {
    pushToken: state.pushToken ?? '',
    platform: state.platform,
    regionIds: state.regionIds,
    followLocation: state.followLocation,
    preferences: state.preferences,
  };
  if (state.lastLocation) reg.lastLocation = state.lastLocation;
  if (state.appVersion) reg.appVersion = state.appVersion;
  return reg;
}

export function toPersisted(state: DeviceState): PersistedState {
  return {
    deviceId: state.deviceId,
    pushToken: state.pushToken,
    platform: state.platform,
    regionIds: state.regionIds,
    followLocation: state.followLocation,
    lastLocation: state.lastLocation,
    preferences: state.preferences,
    appVersion: state.appVersion,
    lastSynced: state.lastSynced,
    testSentAt: state.testSentAt,
  };
}

/** True when the current registration differs from what the server last acknowledged. */
export function needsSync(state: DeviceState): boolean {
  if (!state.pushToken) return false;
  if (!state.deviceId || !state.lastSynced) return true;
  return JSON.stringify(toRegistration(state)) !== JSON.stringify(state.lastSynced);
}
