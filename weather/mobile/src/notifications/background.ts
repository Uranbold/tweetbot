import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_NOTIFICATION_TASK = 'skycast-background-notification';

/**
 * Stub for data-only (silent) pushes received while the app is backgrounded/killed.
 * The dispatcher currently sends visible notifications, so this only logs; it is the hook point
 * for later work such as refreshing the region cache or updating a home-screen widget.
 */
export function defineBackgroundNotificationTask(): void {
  if (Platform.OS === 'web') return;
  if (TaskManager.isTaskDefined(BACKGROUND_NOTIFICATION_TASK)) return;
  TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[skycast] background notification task error', error.message);
      return;
    }
    if (__DEV__) console.log('[skycast] background notification received', JSON.stringify(data).slice(0, 300));
  });
}

export async function registerBackgroundNotificationTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    defineBackgroundNotificationTask();
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch (err) {
    // Not available in Expo Go / some simulators; non-fatal.
    if (__DEV__) console.log('[skycast] background task not registered:', (err as Error).message);
  }
}
