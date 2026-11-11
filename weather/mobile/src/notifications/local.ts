import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Region } from '@contract';
import { buildLocalTestAlert } from './content';

/**
 * Schedules a local notification shaped like a backend NotificationMessage, so the tap → deep-link path
 * can be exercised without a server or a real push token. Returns the scheduled id, or null on web.
 */
export async function scheduleLocalTestAlert(seconds = 5, region: Pick<Region, 'id' | 'name'> = { id: 'mn-ulaanbaatar', name: 'Ulaanbaatar' }): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const content = buildLocalTestAlert(region);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: content.sound ? 'default' : undefined,
      data: content.data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, seconds),
      repeats: false,
      ...(Platform.OS === 'android' ? { channelId: content.channelId } : {}),
    },
  });
}
