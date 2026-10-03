import React from 'react';
import { StyleSheet, View } from 'react-native';
import { computeRangeBar } from '@/lib/rangeBar';
import { useTheme } from '@/theme';

export interface RangeBarProps {
  min: number;
  max: number;
  globalMin: number;
  globalMax: number;
  /** Optional marker (today's current temperature) drawn as a dot. */
  marker?: number;
  height?: number;
  testID?: string;
}

/** Weekly min/max range bar on a shared 10-day scale (§4.4): cold→warm two-tone fill, dot for "now". */
export function RangeBar({ min, max, globalMin, globalMax, marker, height = 6, testID }: RangeBarProps) {
  const t = useTheme();
  const g = computeRangeBar(min, max, globalMin, globalMax);
  const markerPct = marker !== undefined && globalMax > globalMin ? Math.min(100, Math.max(0, ((marker - globalMin) / (globalMax - globalMin)) * 100)) : null;
  return (
    <View
      testID={testID ?? 'range-bar'}
      accessibilityLabel={`${Math.round(min)} to ${Math.round(max)} degrees`}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: t.colors.surface2 }]}
    >
      <View
        testID="range-bar-fill"
        style={[styles.fill, { left: `${g.leftPct}%`, width: `${g.widthPct}%`, height, borderRadius: height / 2, backgroundColor: t.colors.cold }]}
      >
        <View style={[styles.half, { backgroundColor: t.colors.warm, borderTopRightRadius: height / 2, borderBottomRightRadius: height / 2 }]} />
      </View>
      {markerPct !== null ? (
        <View
          testID="range-bar-marker"
          style={[
            styles.marker,
            {
              left: `${markerPct}%`,
              width: height + 6,
              height: height + 6,
              borderRadius: (height + 6) / 2,
              marginLeft: -(height + 6) / 2,
              top: -3,
              backgroundColor: t.colors.surface,
              borderColor: t.colors.accent,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', position: 'relative' },
  fill: { position: 'absolute', flexDirection: 'row', justifyContent: 'flex-end', overflow: 'hidden' },
  half: { width: '50%', height: '100%' },
  marker: { position: 'absolute', borderWidth: 2 },
});
