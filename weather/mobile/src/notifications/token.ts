import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getInstallId } from '@/store/persistence';
import type { PermissionStatus } from '@/store/reducer';

export function pushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** EAS project id from app config (`extra.eas.projectId`) or the EAS manifest. */
export function getProjectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  const id = fromExtra || fromEas;
  return id && id.length > 0 ? id : undefined;
}

export async function getNotificationPermission(): Promise<PermissionStatus> {
  if (!pushSupported()) return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (!pushSupported()) return 'unsupported';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return 'granted';
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'denied';
  }
}

/** Dev placeholder so the register flow works in Expo Go / simulators / web without an EAS project id. */
export async function devPlaceholderToken(): Promise<string> {
  const installId = await getInstallId();
  const model = (Device.modelName ?? Platform.OS).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase();
  return `ExponentPushToken[dev-${model}-${installId}]`;
}

/**
 * Resolve the Expo push token. Falls back to a dev placeholder when:
 *  - running on web / a simulator (no APNs/FCM),
 *  - no EAS projectId is configured,
 *  - the native call throws (Expo Go on Android SDK 53+ no longer supports remote push).
 */
export async function resolvePushToken(): Promise<{ token: string; placeholder: boolean }> {
  if (!pushSupported() || !Device.isDevice) {
    return { token: await devPlaceholderToken(), placeholder: true };
  }
  const projectId = getProjectId();
  if (!projectId) {
    return { token: await devPlaceholderToken(), placeholder: true };
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { token: data, placeholder: false };
  } catch {
    return { token: await devPlaceholderToken(), placeholder: true };
  }
}
