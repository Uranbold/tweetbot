import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AirGrade } from '@contract';
import { gradeColor } from '@/lib/colors';
import { useTheme } from '@/theme';

export interface GradeChipProps {
  /** "PM10" / "PM2.5" */
  pollutant: string;
  grade: AirGrade;
  /** Localised grade label ("Good", "Сайн", "좋음"). */
  gradeLabel: string;
  value?: number;
  testID?: string;
}

/** Korean 4-tier colour chip: blue / green / orange / red. */
export function GradeChip({ pollutant, grade, gradeLabel, value, testID }: GradeChipProps) {
  const t = useTheme();
  const color = gradeColor(grade);
  return (
    <View
      testID={testID ?? `grade-chip-${grade}`}
      accessibilityLabel={`${pollutant} ${gradeLabel}${value !== undefined ? ` ${value}` : ''}`}
      style={[styles.chip, { backgroundColor: t.colors.cardAlt, borderColor: t.colors.border }]}
    >
      <View testID="grade-dot" style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pollutant, { color: t.colors.textMuted }]}>{pollutant}</Text>
      <Text testID="grade-label" style={[styles.grade, { color }]}>
        {gradeLabel}
      </Text>
      {value !== undefined ? <Text style={[styles.value, { color: t.colors.textFaint }]}>{Math.round(value)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pollutant: { fontSize: 12, fontWeight: '600' },
  grade: { fontSize: 13, fontWeight: '800' },
  value: { fontSize: 11, fontWeight: '500' },
});
