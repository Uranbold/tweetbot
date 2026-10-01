import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DailyPoint } from '@contract';
import type { Dictionary, Locale } from '@/i18n';
import { formatDayLabel, formatShortDate, roundTemp } from '@/lib/format';
import { globalExtent } from '@/lib/rangeBar';
import { type, useTheme } from '@/theme';
import { RangeBar } from './RangeBar';
import { WeatherIcon } from './WeatherIcon';

export interface DailyListProps {
  days: DailyPoint[];
  todayDate: string;
  locale: Locale;
  t: Dictionary;
  /** Rows shown before "Show more" (Miller: 7). */
  initialCount?: number;
  /** Today's current temperature, drawn as a dot on the first row. */
  currentTemp?: number;
}

/** Weekly list (§4.4): day · AM icon+% · PM icon+% · min · range bar · max; 7 rows then "Show 10 days". */
export function DailyList({ days, todayDate, locale, t, initialCount = 7, currentTemp }: DailyListProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? days : days.slice(0, initialCount);
  const ext = useMemo(() => globalExtent(days), [days]);
  return (
    <View testID="daily-list">
      {visible.map((d, i) => (
        <View
          key={d.date}
          accessibilityLabel={`${formatDayLabel(d.date, todayDate, locale, t)} ${roundTemp(d.temperatureMin)} to ${roundTemp(d.temperatureMax)}, ${d.am.condition.label} morning, ${d.pm.condition.label} afternoon`}
          style={[styles.row, i > 0 && { borderTopColor: theme.colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
        >
          <View style={styles.day}>
            <Text style={[type.smallStrong, { color: i === 0 ? theme.colors.accent : theme.colors.fg }]}>{formatDayLabel(d.date, todayDate, locale, t)}</Text>
            <Text style={[type.label, { color: theme.colors.fg3 }]}>{formatShortDate(d.date)}</Text>
          </View>
          <View style={styles.half}>
            <WeatherIcon condition={d.am.condition.key} isDay size={26} label={`${t.am} ${d.am.condition.label}`} />
            <Text style={[type.label, { color: d.am.precipitationProbability > 0 ? theme.colors.cold : theme.colors.fg3 }]}>{Math.round(d.am.precipitationProbability)}%</Text>
          </View>
          <View style={styles.half}>
            <WeatherIcon condition={d.pm.condition.key} isDay={false} size={26} label={`${t.pm} ${d.pm.condition.label}`} />
            <Text style={[type.label, { color: d.pm.precipitationProbability > 0 ? theme.colors.cold : theme.colors.fg3 }]}>{Math.round(d.pm.precipitationProbability)}%</Text>
          </View>
          <Text style={[type.smallStrong, type.num, styles.min, { color: theme.colors.fg2 }]}>{roundTemp(d.temperatureMin)}</Text>
          <View style={styles.bar}>
            <RangeBar min={d.temperatureMin} max={d.temperatureMax} globalMin={ext.min} globalMax={ext.max} marker={i === 0 ? currentTemp : undefined} />
          </View>
          <Text style={[type.smallStrong, type.num, styles.max, { color: theme.colors.fg }]}>{roundTemp(d.temperatureMax)}</Text>
        </View>
      ))}
      {days.length > initialCount ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          style={styles.more}
          testID="daily-show-more"
        >
          <Text style={[type.smallStrong, { color: theme.colors.accent }]}>{expanded ? t.showLess : t.showMore(days.length)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 6, gap: 6 },
  day: { width: 56 },
  half: { alignItems: 'center', width: 38 },
  min: { width: 36, textAlign: 'right' },
  bar: { flex: 1, paddingHorizontal: 6 },
  max: { width: 36 },
  more: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
