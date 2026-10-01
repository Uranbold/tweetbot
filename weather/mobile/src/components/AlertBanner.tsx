import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AlertSeverity } from '@contract';
import { SEVERITY_COLORS } from '@/lib/colors';

export interface AlertBannerProps {
  severity: AlertSeverity;
  title: string;
  description?: string;
  /** e.g. "Advisory" / "주의보" */
  severityLabel: string;
  period?: string;
  onPress?: () => void;
  onDismiss?: () => void;
  testID?: string;
}

/** Advisory → amber, warning → red (Naver 주의보/경보). */
export function AlertBanner({ severity, title, description, severityLabel, period, onPress, onDismiss, testID }: AlertBannerProps) {
  const c = SEVERITY_COLORS[severity];
  return (
    <Pressable
      testID={testID ?? `alert-banner-${severity}`}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.banner, { backgroundColor: c.bg, borderLeftColor: c.border }]}
    >
      <View style={styles.header}>
        <View style={[styles.pill, { backgroundColor: c.border }]}>
          <Text style={styles.pillText}>{severityLabel}</Text>
        </View>
        <Text style={[styles.title, { color: c.fg }]} numberOfLines={2}>
          {title}
        </Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss" style={styles.close}>
            <Text style={[styles.closeText, { color: c.fg }]}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {description ? (
        <Text style={[styles.desc, { color: c.fg }]} numberOfLines={3}>
          {description}
        </Text>
      ) : null}
      {period ? <Text style={[styles.period, { color: c.fg }]}>{period}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 12, borderLeftWidth: 4, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  title: { flex: 1, fontSize: 14, fontWeight: '700' },
  close: { paddingHorizontal: 4 },
  closeText: { fontSize: 20, lineHeight: 20, fontWeight: '600' },
  desc: { marginTop: 4, fontSize: 13, opacity: 0.9 },
  period: { marginTop: 4, fontSize: 11, opacity: 0.75 },
});
