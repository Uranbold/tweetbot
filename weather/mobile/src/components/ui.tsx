import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { typography, useTheme } from '@/theme';

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: t.colors.card, borderColor: t.colors.border, borderRadius: t.radius.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[typography.section, { color: t.colors.text }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Chip({
  label,
  color,
  bg,
  testID,
  small,
}: {
  label: string;
  color: string;
  bg?: string;
  testID?: string;
  small?: boolean;
}) {
  return (
    <View
      testID={testID}
      style={[styles.chip, { backgroundColor: bg ?? `${color}22`, borderColor: color }, small && styles.chipSmall]}
    >
      <Text style={[styles.chipText, { color }, small && { fontSize: 11 }]}>{label}</Text>
    </View>
  );
}

export function DemoBadge({ label, stale }: { label: string; stale?: string }) {
  const t = useTheme();
  return (
    <View style={styles.badgeRow}>
      <View style={[styles.badge, { backgroundColor: t.colors.warning }]}>
        <Text style={styles.badgeText}>{label}</Text>
      </View>
      {stale ? (
        <View style={[styles.badge, { backgroundColor: t.colors.textFaint }]}>
          <Text style={styles.badgeText}>{stale}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.center} testID="loading">
      <ActivityIndicator color={t.colors.accent} />
      <Text style={[typography.small, { color: t.colors.textMuted, marginTop: 8 }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.center} testID="error">
      <Text style={[typography.body, { color: t.colors.danger, textAlign: 'center' }]}>{message}</Text>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} variant="secondary" style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[typography.body, { color: t.colors.textMuted, fontWeight: '600' }]}>{title}</Text>
      {hint ? <Text style={[typography.small, { color: t.colors.textFaint, marginTop: 4, textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.colors.accent : variant === 'danger' ? t.colors.danger : t.colors.cardAlt;
  const fg = variant === 'secondary' ? t.colors.text : '#ffffff';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderRadius: t.radius.sm, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginVertical: 8 }} />;
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.kv}>
      <Text style={[typography.tiny, { color: t.colors.textFaint, textTransform: 'uppercase' }]}>{label}</Text>
      <Text style={[typography.body, { color: t.colors.text, fontWeight: '600', marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipSmall: { paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 12, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#1a1d21', fontSize: 11, fontWeight: '700' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  button: { paddingHorizontal: 16, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  kv: { flex: 1, minWidth: 90 },
});
