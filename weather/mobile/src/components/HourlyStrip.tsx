import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HourlyPoint } from '@contract';
import type { Locale } from '@/i18n/types';
import { formatDayLabel, formatHour, parseWallClock, roundTemp } from '@/lib/format';
import { type, useTheme } from '@/theme';
import { WeatherIcon } from './WeatherIcon';

export const HOUR_COLUMN_WIDTH = 56;

export interface HourlyStripProps {
  hours: HourlyPoint[];
  locale: Locale;
  nowLabel: string;
  todayDate: string;
  labels: { today: string; tomorrow: string };
  count?: number;
}

/**
 * Hourly strip (§4.3): 56 px columns with snap, day label at the start of each day segment,
 * "now" column with an accent 2 px rule, precipitation % as text + 4 px bar anchored to the baseline.
 */
export function HourlyStrip({ hours, locale, nowLabel, todayDate, labels, count = 24 }: HourlyStripProps) {
  const t = useTheme();
  const slice = useMemo(() => hours.slice(0, count), [hours, count]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={HOUR_COLUMN_WIDTH}
      decelerationRate="fast"
      contentContainerStyle={styles.content}
      testID="hourly-strip"
      accessibilityLabel="Hourly forecast, scrollable"
    >
      {slice.map((h, i) => {
        const wc = parseWallClock(h.time);
        const prev = i > 0 ? parseWallClock(slice[i - 1]?.time ?? '') : null;
        const dayStart = i === 0 || (wc && prev && wc.day !== prev.day);
        const dayLabel = dayStart && wc ? formatDayLabel(h.time, todayDate, locale, labels) : '';
        const isNow = i === 0;
        const pp = Math.round(h.precipitationProbability);
        return (
          <View key={h.time} style={styles.cell} accessibilityLabel={`${formatHour(h.time, locale)}, ${h.condition.label}, ${roundTemp(h.temperature)}, ${pp} percent precipitation`}>
            <Text style={[type.eyebrow, { color: t.colors.fg3, height: 14 }]} numberOfLines={1}>
              {dayLabel}
            </Text>
            <Text style={[type.label, { color: isNow ? t.colors.accent : t.colors.fg2 }]}>{isNow ? nowLabel : formatHour(h.time, locale)}</Text>
            {isNow ? <View style={[styles.nowRule, { backgroundColor: t.colors.accent }]} /> : <View style={styles.nowRule} />}
            <WeatherIcon condition={h.condition.key} isDay={h.condition.isDay} size={30} label={h.condition.label} />
            <Text style={[type.bodyStrong, type.num, { color: t.colors.fg }]}>{roundTemp(h.temperature)}</Text>
            <View style={styles.precipWrap}>
              <View style={[styles.precipBar, { height: Math.max(2, (pp / 100) * 14), backgroundColor: pp > 0 ? t.colors.cold : t.colors.surface2 }]} />
              <Text style={[type.label, { color: pp > 0 ? t.colors.cold : t.colors.fg3 }]}>{pp}%</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingRight: 8 },
  cell: { width: HOUR_COLUMN_WIDTH, alignItems: 'center', paddingVertical: 4, gap: 3 },
  nowRule: { width: 2, height: 10, borderRadius: 1 },
  precipWrap: { alignItems: 'center', justifyContent: 'flex-end', height: 34, gap: 2 },
  precipBar: { width: 10, borderRadius: 2 },
});
