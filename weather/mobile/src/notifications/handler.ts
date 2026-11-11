import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let configured = false;

/**
 * Foreground presentation: show the banner + list entry, play the sound, no badge spam.
 * Daily briefings arriving in the foreground stay silent.
 */
export function configureForegroundHandler(): void {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const kind = notification.request.content.data?.kind;
      const quiet = kind === 'daily-briefing';
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: !quiet,
        shouldSetBadge: false,
      };
    },
  });
}
