import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/i18n';
import { useNotifications } from '@/notifications/NotificationsProvider';
import { useTheme } from '@/theme';
import { AlertBanner } from './AlertBanner';

const AUTO_DISMISS_MS = 8000;

/** In-app toast for notifications that arrive while the app is open; tap follows the deep link. */
export function ForegroundNotice() {
  const { notice, dismissNotice, openDeepLink } = useNotifications();
  const insets = useSafeAreaInsets();
  const t = useT();
  const theme = useTheme();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice || Platform.OS === 'web') return null;
  const severity = notice.severity === 'warning' ? 'warning' : 'advisory';
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]} accessibilityLiveRegion="assertive">
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.card }]}>
        <AlertBanner
          severity={severity}
          severityLabel={t.severity[severity]}
          title={notice.title}
          description={notice.body}
          onPress={() => {
            dismissNotice();
            openDeepLink(notice.deepLink);
          }}
          onDismiss={dismissNotice}
          testID="foreground-notice"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 100 },
  sheet: { shadowColor: 'rgb(10,20,40)', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
});
