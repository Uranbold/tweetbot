import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { tint, type, useTheme } from '@/theme';

/** Card (§3.6): flat, 16 px radius, 16 px padding, hairline border on light / lighter surface on dark. */
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderWidth: t.cardBorderWidth, borderRadius: t.radius.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, right, eyebrow }: { children: React.ReactNode; right?: React.ReactNode; eyebrow?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={eyebrow ? [type.eyebrow, { color: t.colors.fg3 }] : [type.heading, { color: t.colors.fg }]} accessibilityRole="header">
        {children}
      </Text>
      {right}
    </View>
  );
}

/** Quiet chip: tinted ground + fg text (Von Restorff: chips are never loud). */
export function Chip({ label, color, testID, small, leading }: { label: string; color?: string; testID?: string; small?: boolean; leading?: React.ReactNode }) {
  const t = useTheme();
  const c = color ?? t.colors.fg3;
  return (
    <View testID={testID} style={[styles.chip, { backgroundColor: tint(c, t.dark ? 0.2 : 0.12), borderRadius: t.radius.chip }, small && styles.chipSmall]}>
      {leading ?? <View style={[styles.dot, { backgroundColor: c }]} />}
      <Text style={[small ? type.label : type.smallStrong, { color: t.colors.fg }]}>{label}</Text>
    </View>
  );
}

/** "Demo data" / "Stale" badges — honest data (§1.4), shown where the data appears. */
export function DataBadges({ demo, stale, demoLabel, staleLabel }: { demo: boolean; stale: boolean; demoLabel: string; staleLabel: string }) {
  const t = useTheme();
  if (!demo && !stale) return null;
  return (
    <View style={styles.badgeRow}>
      {demo ? (
        <View testID="demo-badge" style={[styles.badge, { backgroundColor: t.colors.surface2, borderRadius: t.radius.chip }]}>
          <Text style={[type.eyebrow, { color: t.colors.fg2 }]}>{demoLabel}</Text>
        </View>
      ) : null}
      {stale ? (
        <View testID="stale-badge" style={[styles.badge, { backgroundColor: tint(t.colors.severity.advisory, 0.14), borderRadius: t.radius.chip }]}>
          <Text style={[type.eyebrow, { color: t.colors.severity.advisory }]}>{staleLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.center} testID="loading" accessibilityLiveRegion="polite">
      <ActivityIndicator color={t.colors.accent} />
      <Text style={[type.small, { color: t.colors.fg2, marginTop: 8 }]}>{label}</Text>
    </View>
  );
}

/** Skeleton block with the same geometry as the content it replaces (Doherty). */
export function Skeleton({ height, width = '100%', radius = 8, style }: { height: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View accessibilityElementsHidden style={[{ height, width, borderRadius: radius, backgroundColor: t.colors.surface2 }, style]} />;
}

export function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.center} testID="error" accessibilityLiveRegion="polite">
      <Text style={[type.body, { color: t.colors.fg, textAlign: 'center' }]}>{message}</Text>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} variant="secondary" style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[type.bodyStrong, { color: t.colors.fg2 }]}>{title}</Text>
      {hint ? <Text style={[type.small, { color: t.colors.fg3, marginTop: 4, textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

/** Button: 10 px radius, ≥ 44 px tall (Fitts). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  testID,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  compact?: boolean;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.colors.accent : variant === 'secondary' ? t.colors.surface2 : 'transparent';
  const fg = variant === 'primary' ? t.colors.accentInk : variant === 'ghost' ? t.colors.accent : t.colors.fg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, borderRadius: t.radius.button, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[type.smallStrong, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider({ spacing = 12 }: { spacing?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginVertical: spacing }} />;
}

/** Label/value pair: label within 4 px of the value (proximity). */
export function KeyValue({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const t = useTheme();
  return (
    <View style={styles.kv} testID={testID}>
      <Text style={[type.eyebrow, { color: t.colors.fg3 }]}>{label}</Text>
      <Text style={[type.bodyStrong, type.num, { color: t.colors.fg, marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

export function CheckIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="check">
      <Path d="M5 12.5 L10 17.5 L19 7" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** "Saved ✓" indicator shown next to a section title after autosave (§4.9). */
export function SavedMark({ visible, label, syncing, syncingLabel }: { visible: boolean; label: string; syncing?: boolean; syncingLabel?: string }) {
  const t = useTheme();
  if (syncing) return <Text style={[type.label, { color: t.colors.fg3 }]}>{syncingLabel ?? '…'}</Text>;
  if (!visible) return null;
  return (
    <View style={styles.saved} testID="saved-mark" accessibilityLiveRegion="polite">
      <CheckIcon color={t.colors.accent} size={14} />
      <Text style={[type.label, { color: t.colors.accent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 32, paddingVertical: 5, alignSelf: 'flex-start' },
  chipSmall: { minHeight: 26, paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  button: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  buttonCompact: { minHeight: 36, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  kv: { flex: 1, minWidth: 72 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
