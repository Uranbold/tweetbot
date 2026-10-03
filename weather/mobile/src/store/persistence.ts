import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistedState } from './reducer';

export const STORAGE_KEY = 'skycast.device.v1';
export const DEVICE_INSTALL_ID_KEY = 'skycast.installId.v1';

export async function loadPersistedState(): Promise<Partial<PersistedState> | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<PersistedState>;
  } catch {
    return null;
  }
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage failures are non-fatal; the next change will retry.
  }
}

export async function clearPersistedState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Stable per-install id (used for the dev placeholder push token). */
export async function getInstallId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_INSTALL_ID_KEY);
    if (existing) return existing;
  } catch {
    // fall through to generate
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    await AsyncStorage.setItem(DEVICE_INSTALL_ID_KEY, id);
  } catch {
    // ignore
  }
  return id;
}
