import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import type { AlertSeverity } from '@contract';
import { tint, type, useTheme } from '@/theme';

export interface AlertBannerProps {
  severity: AlertSeverity;
  title: string;
  description?: string;
  /** e.g. "Advisory" / "주의보" */
  severityLabel: string;
  period?: string;
  /** Tap behaviour: expand the description (default) or navigate. */
  onPress?: () => void;
  onDismiss?: () => void;
  testID?: string;
}

/** Severity glyph (§3.3): ▲ outline for advisory, ⚠ filled badge for warning. */
export function SeverityGlyph({ severity, color, ink, size = 18 }: { severity: AlertSeverity; color: string; ink: string; size?: number }) {
  if (severity === 'warning') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="warning">
        <Path d="M12 2.5 L23 21 H1 Z" fill={color} />
        <Line x1={12} y1={9} x2={12} y2={14.5} stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
        <Line x1={12} y1={17.6} x2={12} y2={17.7} stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="advisory">
      <Path d="M12 3.5 L22 20 H2 Z" stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Alert banner (§4.2). Warning: 4 px left stripe + filled glyph. Advisory: outline glyph, no stripe.
 * Tap expands the threshold rationale. Dismiss is only offered for transient in-app notices.
 */
export function AlertBanner({ severity, title, description, severityLabel, period, onPress, onDismiss, testID }: AlertBannerProps) {
  const t = useTheme();
  const color = t.colors.severity[severity];
  const [expanded, setExpanded] = useState(false);
  const handlePress = onPress ?? (description ? () => setExpanded((e) => !e) : undefined);
  const isWarning = severity === 'warning';
  return (
    <Pressable
      testID={testID ?? `alert-banner-${severity}`}
      onPress={handlePress}
      disabled={!handlePress}
      accessibilityRole={handlePress ? 'button' : 'text'}
      accessibilityLabel={`${severityLabel}: ${title}`}
      accessibilityState={onPress ? undefined : { expanded }}
      style={[
        styles.banner,
        { backgroundColor: tint(color, t.dark ? 0.18 : 0.1), borderRadius: t.radius.card - 4 },
        isWarning && { borderLeftWidth: 4, borderLeftColor: color },
      ]}
    >
      <View style={styles.header}>
        <SeverityGlyph severity={severity} color={color} ink={t.colors.surface} />
        <Text style={[type.eyebrow, { color }]}>{severityLabel}</Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.close}>
            <Text style={[styles.closeText, { color: t.colors.fg2 }]}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[type.bodyStrong, { color: t.colors.fg, marginTop: 4 }]} numberOfLines={expanded ? undefined : 2}>
        {title}
      </Text>
      {period ? <Text style={[type.label, { color: t.colors.fg2, marginTop: 2 }]}>{period}</Text> : null}
      {description && (expanded || !!onPress) ? (
        <Text style={[type.small, { color: t.colors.fg2, marginTop: 6 }]} numberOfLines={onPress ? 3 : undefined}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  close: { marginLeft: 'auto', paddingHorizontal: 6, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, lineHeight: 24 },
});
