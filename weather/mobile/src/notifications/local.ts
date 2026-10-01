import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { regionDeepLink } from '@/lib/deepLink';
import { WEATHER_ALERTS_CHANNEL_ID } from './channels';

/**
 * Schedules a local notification shaped like a backend NotificationMessage, so the tap → deep-link path
 * can be exercised without a server or a real push token. Returns the scheduled id, or null on web.
 */
export async function scheduleLocalTestAlert(seconds = 5, regionId = 'mn-ulaanbaatar'): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Cold wave advisory — test',
      body: 'Local test alert: morning low below -10 °C expected. Tap to open region alerts.',
      sound: 'default',
      data: {
        kind: 'test',
        regionId,
        deepLink: regionDeepLink(regionId, true),
        severity: 'advisory',
        dedupKey: `test:${regionId}:${Date.now()}`,
      },
      ...(Platform.OS === 'android' ? { channelId: WEATHER_ALERTS_CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, seconds),
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: WEATHER_ALERTS_CHANNEL_ID } : {}),
    },
  });
}
