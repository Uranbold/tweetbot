import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const WEATHER_ALERTS_CHANNEL_ID = 'weather-alerts';
export const BRIEFING_CHANNEL_ID = 'daily-briefing';

/** Android notification channels. No-op on iOS/web. */
export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(WEATHER_ALERTS_CHANNEL_ID, {
    name: 'Weather alerts',
    description: 'Advisories, warnings, AI hazard risks and bad air quality',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#03c75a',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableVibrate: true,
  });
  await Notifications.setNotificationChannelAsync(BRIEFING_CHANNEL_ID, {
    name: 'Daily briefing',
    description: 'One summary per day for your regions',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 200],
  });
}
