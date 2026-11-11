import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Device } from '@contract';
import { loadPersistedState, savePersistedState, STORAGE_KEY } from '../persistence';
import { ALL_ALERT_TYPES, DEFAULT_PREFERENCES, initialState, needsSync, reducer, toPersisted, toRegistration, type DeviceState } from '../reducer';

const device: Device = {
  id: 'dev_1',
  pushToken: 'ExponentPushToken[abc]',
  platform: 'android',
  regionIds: ['mn-ulaanbaatar'],
  followLocation: false,
  preferences: DEFAULT_PREFERENCES,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

describe('device reducer', () => {
  it('hydrates with defaults merged into stored preferences', () => {
    const s = reducer(initialState, { type: 'HYDRATE', payload: { regionIds: ['kr-seoul'], preferences: { locale: 'mn' } as never } });
    expect(s.hydrated).toBe(true);
    expect(s.regionIds).toEqual(['kr-seoul']);
    expect(s.preferences.locale).toBe('mn');
    expect(s.preferences.alertTypes).toEqual(ALL_ALERT_TYPES);
    expect(s.preferences.aiRiskThreshold).toBe(0.6);
  });

  it('registers: token → dirty → sync success stores server id and lastSynced', () => {
    let s = reducer({ ...initialState, hydrated: true }, { type: 'SET_PUSH_TOKEN', token: 'ExponentPushToken[abc]' });
    expect(s.syncStatus).toBe('pending');
    expect(needsSync(s)).toBe(true);
    s = reducer(s, { type: 'TOGGLE_REGION', regionId: 'mn-ulaanbaatar' });
    s = reducer(s, { type: 'SYNC_STARTED' });
    expect(s.syncStatus).toBe('syncing');
    s = reducer(s, { type: 'SYNC_SUCCEEDED', device });
    expect(s.deviceId).toBe('dev_1');
    expect(s.syncStatus).toBe('synced');
    expect(s.lastSynced).toEqual(toRegistration(s));
    expect(needsSync(s)).toBe(false);
  });

  it('toggles regions on and off and detects drift from lastSynced', () => {
    let s: DeviceState = { ...initialState, hydrated: true, pushToken: 'tok', deviceId: 'dev_1' };
    s = { ...s, lastSynced: toRegistration(s) };
    expect(needsSync(s)).toBe(false);
    s = reducer(s, { type: 'TOGGLE_REGION', regionId: 'kr-seoul' });
    expect(s.regionIds).toEqual(['kr-seoul']);
    expect(needsSync(s)).toBe(true);
    s = reducer(s, { type: 'TOGGLE_REGION', regionId: 'kr-seoul' });
    expect(s.regionIds).toEqual([]);
    expect(needsSync(s)).toBe(false);
  });

  it('updates preferences as partial patches', () => {
    let s = reducer({ ...initialState, hydrated: true }, { type: 'UPDATE_PREFERENCES', patch: { aiRiskThreshold: 0.8 } });
    s = reducer(s, { type: 'UPDATE_PREFERENCES', patch: { quietHours: { start: 23, end: 6 }, locale: 'ko' } });
    expect(s.preferences).toEqual({ ...DEFAULT_PREFERENCES, aiRiskThreshold: 0.8, quietHours: { start: 23, end: 6 }, locale: 'ko' });
    expect(s.dirtyVersion).toBe(2);
  });

  it('does not sync without a push token', () => {
    const s = reducer({ ...initialState, hydrated: true }, { type: 'TOGGLE_REGION', regionId: 'kr-seoul' });
    expect(needsSync(s)).toBe(false);
  });

  it('records sync failures without losing local state', () => {
    let s = reducer({ ...initialState, hydrated: true, pushToken: 'tok' }, { type: 'TOGGLE_REGION', regionId: 'kr-seoul' });
    s = reducer(s, { type: 'SYNC_FAILED', error: 'Cannot reach the Skycast server.' });
    expect(s.syncStatus).toBe('error');
    expect(s.regionIds).toEqual(['kr-seoul']);
    expect(needsSync(s)).toBe(true);
  });

  it('toRegistration matches the DeviceRegistration contract exactly', () => {
    const s: DeviceState = {
      ...initialState,
      pushToken: 'tok',
      platform: 'ios',
      regionIds: ['a'],
      followLocation: true,
      lastLocation: { lat: 1, lon: 2 },
      appVersion: '0.1.0',
    };
    expect(toRegistration(s)).toEqual({
      pushToken: 'tok',
      platform: 'ios',
      regionIds: ['a'],
      followLocation: true,
      lastLocation: { lat: 1, lon: 2 },
      preferences: DEFAULT_PREFERENCES,
      appVersion: '0.1.0',
    });
    expect(Object.keys(toRegistration({ ...s, lastLocation: undefined, appVersion: undefined }))).toEqual(['pushToken', 'platform', 'regionIds', 'followLocation', 'preferences']);
  });
});

describe('persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips the persisted subset through AsyncStorage', async () => {
    let s: DeviceState = { ...initialState, hydrated: true };
    s = reducer(s, { type: 'SET_PUSH_TOKEN', token: 'ExponentPushToken[abc]' });
    s = reducer(s, { type: 'TOGGLE_REGION', regionId: 'mn-ulaanbaatar' });
    s = reducer(s, { type: 'UPDATE_PREFERENCES', patch: { dailyBriefingHour: 7 } });
    s = reducer(s, { type: 'SYNC_SUCCEEDED', device });
    s = reducer(s, { type: 'TEST_SENT', at: '2026-10-01T06:00:00Z' });

    await savePersistedState(toPersisted(s));
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeTruthy();

    const loaded = await loadPersistedState();
    const rehydrated = reducer(initialState, { type: 'HYDRATE', payload: loaded });
    expect(rehydrated.deviceId).toBe('dev_1');
    expect(rehydrated.pushToken).toBe('ExponentPushToken[abc]');
    expect(rehydrated.regionIds).toEqual(['mn-ulaanbaatar']);
    expect(rehydrated.preferences.dailyBriefingHour).toBe(7);
    expect(rehydrated.testSentAt).toBe('2026-10-01T06:00:00Z');
    expect(rehydrated.lastSynced).toEqual(s.lastSynced);
    // Nothing drifted, so no sync is needed after a cold start.
    expect(needsSync(rehydrated)).toBe(false);
  });

  it('returns null for missing or corrupt storage', async () => {
    expect(await loadPersistedState()).toBeNull();
    await AsyncStorage.setItem(STORAGE_KEY, '{not json');
    expect(await loadPersistedState()).toBeNull();
  });
});
