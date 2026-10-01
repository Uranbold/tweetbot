import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DailyPoint } from '@contract';
import type { Dictionary, Locale } from '@/i18n';
import { formatDayLabel, formatShortDate, roundTemp } from '@/lib/format';
import { globalExtent } from '@/lib/rangeBar';
import { useTheme } from '@/theme';
import { RangeBar } from './RangeBar';
import { WeatherIcon } from './WeatherIcon';

export interface DailyListProps {
  days: DailyPoint[];
  todayDate: string;
  locale: Locale;
  t: Dictionary;
  count?: number;
  /** Today's current temperature, drawn as a marker on the first row. */
  currentTemp?: number;
}

/** Naver-style 7/10-day list: day, AM/PM icons with precip %, min — range bar — max. */
export function DailyList({ days, todayDate, locale, t, count = 7, currentTemp }: DailyListProps) {
  const theme = useTheme();
  const slice = days.slice(0, count);
  const ext = globalExtent(slice);
  return (
    <View testID="daily-list">
      {slice.map((d, i) => (
        <View key={d.date} style={[styles.row, i > 0 && { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={styles.day}>
            <Text style={[styles.dayLabel, { color: i === 0 ? theme.colors.accent : theme.colors.text }]}>
              {formatDayLabel(d.date, todayDate, locale, { today: t.today, tomorrow: t.tomorrow })}
            </Text>
            <Text style={[styles.date, { color: theme.colors.textFaint }]}>{formatShortDate(d.date)}</Text>
          </View>
          <View style={styles.half}>
            <WeatherIcon condition={d.am.condition.key} isDay size={30} />
            <Text style={[styles.pp, { color: d.am.precipitationProbability > 0 ? '#1e88e5' : theme.colors.textFaint }]}>
              {Math.round(d.am.precipitationProbability)}%
            </Text>
          </View>
          <View style={styles.half}>
            <WeatherIcon condition={d.pm.condition.key} isDay={false} size={30} />
            <Text style={[styles.pp, { color: d.pm.precipitationProbability > 0 ? '#1e88e5' : theme.colors.textFaint }]}>
              {Math.round(d.pm.precipitationProbability)}%
            </Text>
          </View>
          <Text style={[styles.min, { color: theme.colors.info }]}>{roundTemp(d.temperatureMin)}</Text>
          <View style={styles.bar}>
            <RangeBar
              min={d.temperatureMin}
              max={d.temperatureMax}
              globalMin={ext.min}
              globalMax={ext.max}
              marker={i === 0 ? currentTemp : undefined}
            />
          </View>
          <Text style={[styles.max, { color: theme.colors.text }]}>{roundTemp(d.temperatureMax)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 6 },
  day: { width: 54 },
  dayLabel: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11, marginTop: 1 },
  half: { alignItems: 'center', width: 40 },
  pp: { fontSize: 10, fontWeight: '600', marginTop: -2 },
  min: { width: 34, textAlign: 'right', fontSize: 14, fontWeight: '600' },
  bar: { flex: 1, paddingHorizontal: 4 },
  max: { width: 34, fontSize: 14, fontWeight: '700' },
});
