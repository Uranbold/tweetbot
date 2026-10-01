import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HourlyPoint } from '@contract';
import { formatHour, roundTemp } from '@/lib/format';
import type { Locale } from '@/i18n/types';
import { useTheme } from '@/theme';
import { WeatherIcon } from './WeatherIcon';

export interface HourlyStripProps {
  hours: HourlyPoint[];
  locale: Locale;
  nowLabel: string;
  count?: number;
}

/** Horizontal 24 h strip: hour, icon, temp, precipitation % (only when > 0). */
export function HourlyStrip({ hours, locale, nowLabel, count = 24 }: HourlyStripProps) {
  const t = useTheme();
  const slice = hours.slice(0, count);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} testID="hourly-strip">
      {slice.map((h, i) => (
        <View key={h.time} style={[styles.cell, i === 0 && { backgroundColor: t.colors.accentSoft, borderRadius: 12 }]}>
          <Text style={[styles.hour, { color: i === 0 ? t.colors.accent : t.colors.textMuted }]}>
            {i === 0 ? nowLabel : formatHour(h.time, locale)}
          </Text>
          <WeatherIcon condition={h.condition.key} isDay={h.condition.isDay} size={34} />
          <Text style={[styles.temp, { color: t.colors.text }]}>{roundTemp(h.temperature)}</Text>
          <Text style={[styles.precip, { color: h.precipitationProbability > 0 ? '#1e88e5' : 'transparent' }]}>
            {h.precipitationProbability > 0 ? `${Math.round(h.precipitationProbability)}%` : '0%'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 4, gap: 2 },
  cell: { width: 56, alignItems: 'center', paddingVertical: 8, gap: 4 },
  hour: { fontSize: 12, fontWeight: '600' },
  temp: { fontSize: 15, fontWeight: '700' },
  precip: { fontSize: 11, fontWeight: '600' },
});
