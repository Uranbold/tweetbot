import React from 'react';
import { StyleSheet, View } from 'react-native';
import { computeRangeBar } from '@/lib/rangeBar';
import { useTheme } from '@/theme';

export interface RangeBarProps {
  min: number;
  max: number;
  globalMin: number;
  globalMax: number;
  /** Optional marker (e.g. current temperature) drawn as a dot. */
  marker?: number;
  height?: number;
  testID?: string;
}

/** Naver-style min/max temperature range bar on a shared scale. */
export function RangeBar({ min, max, globalMin, globalMax, marker, height = 6, testID }: RangeBarProps) {
  const t = useTheme();
  const g = computeRangeBar(min, max, globalMin, globalMax);
  const markerPct =
    marker !== undefined && globalMax > globalMin
      ? Math.min(100, Math.max(0, ((marker - globalMin) / (globalMax - globalMin)) * 100))
      : null;
  // Cold → blue, warm → orange gradient approximated with two blocks.
  const warm = max >= 20 ? '#fb8c00' : max >= 10 ? '#f5b400' : '#5aa9f0';
  const cold = min <= 0 ? '#1e88e5' : min <= 10 ? '#5aa9f0' : '#9cd3a0';
  return (
    <View testID={testID ?? 'range-bar'} style={[styles.track, { height, borderRadius: height / 2, backgroundColor: t.colors.track }]}>
      <View
        testID="range-bar-fill"
        style={[
          styles.fill,
          { left: `${g.leftPct}%`, width: `${g.widthPct}%`, height, borderRadius: height / 2, backgroundColor: cold },
        ]}
      >
        <View style={[styles.half, { backgroundColor: warm, borderTopRightRadius: height / 2, borderBottomRightRadius: height / 2 }]} />
      </View>
      {markerPct !== null ? (
        <View
          testID="range-bar-marker"
          style={[
            styles.marker,
            {
              left: `${markerPct}%`,
              width: height + 4,
              height: height + 4,
              borderRadius: (height + 4) / 2,
              marginLeft: -(height + 4) / 2,
              top: -2,
              backgroundColor: t.colors.card,
              borderColor: t.colors.text,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'visible', position: 'relative' },
  fill: { position: 'absolute', flexDirection: 'row', justifyContent: 'flex-end', overflow: 'hidden' },
  half: { width: '50%', height: '100%' },
  marker: { position: 'absolute', borderWidth: 2 },
});
