import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useDeviceStore } from '@/store/DeviceProvider';
import { deepLinkFromNotificationData, parseDeepLink } from '@/lib/deepLink';
import { ensureNotificationChannels } from './channels';
import { configureForegroundHandler } from './handler';
import { registerBackgroundNotificationTask } from './background';
import { getNotificationPermission, requestNotificationPermission, resolvePushToken } from './token';

export interface ForegroundNotice {
  id: string;
  title: string;
  body: string;
  deepLink: string | null;
  severity?: string;
  receivedAt: number;
}

interface NotificationsContextValue {
  /** Last notification that arrived while the app was in the foreground (for the in-app banner). */
  notice: ForegroundNotice | null;
  dismissNotice: () => void;
  /** Ask for OS permission and (re)resolve the push token. */
  enableNotifications: () => Promise<void>;
  /** True when the current token is a dev placeholder rather than a real Expo push token. */
  placeholderToken: boolean;
  /** Navigate to a deep link emitted by the backend. Returns false when it could not be parsed. */
  openDeepLink: (url: string | null | undefined) => boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

configureForegroundHandler();

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { state, setPushToken, setPermission } = useDeviceStore();
  const router = useRouter();
  const [notice, setNotice] = useState<ForegroundNotice | null>(null);
  const [placeholderToken, setPlaceholderToken] = useState(false);
  const bootstrappedRef = useRef(false);
  const handledResponseRef = useRef<string | null>(null);

  const openDeepLink = useCallback(
    (url: string | null | undefined) => {
      const path = parseDeepLink(url);
      if (!path) return false;
      // Cast: expo-router's typed routes are not generated in this build; paths come from the parser.
      router.push(path as never);
      return true;
    },
    [router],
  );

  const resolveToken = useCallback(async () => {
    const { token, placeholder } = await resolvePushToken();
    setPlaceholderToken(placeholder);
    setPushToken(token);
  }, [setPushToken]);

  const enableNotifications = useCallback(async () => {
    const status = await requestNotificationPermission();
    setPermission(status);
    await resolveToken();
  }, [resolveToken, setPermission]);

  // Bootstrap once the store is hydrated: channels, permission status, token, background task.
  useEffect(() => {
    if (!state.hydrated || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    void (async () => {
      await ensureNotificationChannels();
      const status = await getNotificationPermission();
      setPermission(status);
      if (status === 'undetermined' && Platform.OS !== 'web') {
        // First run: ask right away — the app's whole purpose is alerts.
        const after = await requestNotificationPermission();
        setPermission(after);
      }
      await resolveToken();
      await registerBackgroundNotificationTask();
    })();
  }, [state.hydrated, resolveToken, setPermission]);

  // Re-check permission when returning from OS settings.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void getNotificationPermission().then(setPermission);
    });
    return () => sub.remove();
  }, [setPermission]);

  // Foreground notifications → in-app banner.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const content = notification.request.content;
      const data = content.data as Record<string, unknown> | undefined;
      setNotice({
        id: notification.request.identifier,
        title: content.title ?? 'Skycast',
        body: content.body ?? '',
        deepLink: deepLinkFromNotificationData(data),
        severity: typeof data?.severity === 'string' ? data.severity : undefined,
        receivedAt: Date.now(),
      });
    });
    return () => sub.remove();
  }, []);

  // Taps on notifications (foreground, background and cold start) → deep link navigation.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledResponseRef.current === id) return;
      handledResponseRef.current = id;
      const link = deepLinkFromNotificationData(response.notification.request.content.data);
      // Give the router a tick to mount on cold start.
      setTimeout(() => openDeepLink(link), 50);
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
    return () => sub.remove();
  }, [openDeepLink]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notice,
      dismissNotice: () => setNotice(null),
      enableNotifications,
      placeholderToken,
      openDeepLink,
    }),
    [notice, enableNotifications, placeholderToken, openDeepLink],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return ctx;
}
