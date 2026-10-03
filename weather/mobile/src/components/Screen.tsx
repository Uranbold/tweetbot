import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type, useTheme } from '@/theme';

/** Single-column scroller: 16 px gutters, max content width 680 (§3.6). */
export function Screen({
  children,
  refreshing,
  onRefresh,
  style,
  testID,
  stickyHeaderIndices,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  stickyHeaderIndices?: number[];
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={[{ flex: 1, backgroundColor: t.colors.bg }, style]}
      contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}
      stickyHeaderIndices={stickyHeaderIndices}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.accent} colors={[t.colors.accent]} /> : undefined}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.column}>{children}</View>
    </ScrollView>
  );
}

/** Screen header: eyebrow (place / section) + title, with an optional right slot. */
export function ScreenHeader({ eyebrow, title, right, testID }: { eyebrow?: string; title: string; right?: React.ReactNode; testID?: string }) {
  const t = useTheme();
  return (
    <View style={styles.header} testID={testID}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={[type.eyebrow, { color: t.colors.fg3, marginBottom: 4 }]}>{eyebrow}</Text> : null}
        <Text style={[type.title, { color: t.colors.fg }]} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8 },
  column: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingVertical: 12, gap: 12 },
});
