import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AirGrade } from '@contract';
import { tint, type, useTheme } from '@/theme';
import { GradeFace } from './GradeFace';

export interface GradeChipProps {
  /** "PM10" / "PM2.5" */
  pollutant: string;
  grade: AirGrade;
  /** Localised grade label ("Good", "Сайн", "좋음"). */
  gradeLabel: string;
  value?: number;
  testID?: string;
}

/**
 * Air-grade chip (§4.5): face glyph + "PM2.5 · Bad · 48" on a 12 % tinted ground with `fg` text.
 * Colour is never the only channel — the glyph and label are mandatory.
 */
export function GradeChip({ pollutant, grade, gradeLabel, value, testID }: GradeChipProps) {
  const t = useTheme();
  const color = t.colors.grade[grade];
  return (
    <View
      testID={testID ?? `grade-chip-${grade}`}
      accessibilityRole="text"
      accessibilityLabel={`${pollutant} ${gradeLabel}${value !== undefined ? `, ${Math.round(value)} micrograms` : ''}`}
      style={[styles.chip, { backgroundColor: tint(color, t.dark ? 0.2 : 0.12), borderRadius: t.radius.chip }]}
    >
      <GradeFace grade={grade} color={color} size={16} />
      <Text style={[type.smallStrong, { color: t.colors.fg }]}>
        {pollutant} <Text style={{ color: t.colors.fg3 }}>·</Text>{' '}
        <Text testID="grade-label">{gradeLabel}</Text>
        {value !== undefined ? (
          <Text style={[type.num, { color: t.colors.fg2 }]}>
            {' '}
            <Text style={{ color: t.colors.fg3 }}>·</Text> {Math.round(value)}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 12,
    minHeight: 32,
    paddingVertical: 5,
  },
});
