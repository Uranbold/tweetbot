import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { PredictedHourly } from '@contract';
import type { Locale } from '@/i18n/types';
import { formatHour } from '@/lib/format';
import { tint, FONT, type, useTheme } from '@/theme';

export interface TempBandChartProps {
  hourly: PredictedHourly[];
  locale: Locale;
  labels: { ai: string; nwp: string; band: string };
  height?: number;
  hours?: number;
  accessibilityLabel?: string;
}

export interface ChartScales {
  x: (i: number) => number;
  y: (v: number) => number;
  min: number;
  max: number;
}

export function buildScales(points: PredictedHourly[], width: number, height: number, pad: { l: number; r: number; t: number; b: number }): ChartScales {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    min = Math.min(min, p.temperatureP10, p.temperatureNwp, p.temperature);
    max = Math.max(max, p.temperatureP90, p.temperatureNwp, p.temperature);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 1;
  }
  if (max - min < 2) {
    max += 1;
    min -= 1;
  }
  const innerW = Math.max(1, width - pad.l - pad.r);
  const innerH = Math.max(1, height - pad.t - pad.b);
  const n = Math.max(1, points.length - 1);
  return {
    x: (i) => pad.l + (i / n) * innerW,
    y: (v) => pad.t + ((max - v) / (max - min)) * innerH,
    min,
    max,
  };
}

function linePath(points: PredictedHourly[], pick: (p: PredictedHourly) => number, s: ChartScales): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${s.x(i).toFixed(1)} ${s.y(pick(p)).toFixed(1)}`).join(' ');
}

export function bandPath(points: PredictedHourly[], s: ChartScales): string {
  if (points.length === 0) return '';
  const upper = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${s.x(i).toFixed(1)} ${s.y(p.temperatureP90).toFixed(1)}`);
  const lower = points
    .map((p, i) => ({ p, i }))
    .reverse()
    .map(({ p, i }) => `L ${s.x(i).toFixed(1)} ${s.y(p.temperatureP10).toFixed(1)}`);
  return `${upper.join(' ')} ${lower.join(' ')} Z`;
}

/**
 * AI chart (§4.6 / §3.4): AI line in `fg` 2 px, P10–P90 band accent 14 %, raw NWP dashed `fg3`.
 * Legend inline above the chart; single y-scale (Occam).
 */
export function TempBandChart({ hourly, locale, labels, height = 180, hours = 48, accessibilityLabel }: TempBandChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const points = useMemo(() => hourly.slice(0, hours), [hourly, hours]);
  const pad = useMemo(() => ({ l: 32, r: 8, t: 8, b: 22 }), []);
  const w = width || 320;
  const scales = useMemo(() => buildScales(points, w, height, pad), [points, w, height, pad]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const yTicks = useMemo(() => {
    const span = scales.max - scales.min;
    const step = span > 30 ? 10 : span > 12 ? 5 : 2;
    const start = Math.ceil(scales.min / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= scales.max; v += step) ticks.push(v);
    return ticks;
  }, [scales]);

  // One label every 8 h keeps ≥ 50 px between labels at 390 px wide (no collisions).
  const xTicks = useMemo(() => points.map((p, i) => ({ p, i })).filter(({ i }) => i % 8 === 0 && i < points.length - 2), [points]);

  const aiColor = theme.colors.fg;
  const nwpColor = theme.colors.fg3;
  const band = tint(theme.colors.accent, 0.14);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout} testID="temp-band-chart">
      <View style={styles.legend} accessibilityElementsHidden>
        <LegendItem color={aiColor} label={labels.ai} />
        <LegendItem color={theme.colors.accent} label={labels.band} soft />
        <LegendItem color={nwpColor} label={labels.nwp} dashed />
      </View>
      <Svg
        width={w}
        height={height}
        accessibilityRole="image"
        accessibilityLabel={
          accessibilityLabel ??
          (first && last ? `${labels.ai} temperature from ${Math.round(first.temperature)} to ${Math.round(last.temperature)} degrees over ${points.length} hours` : labels.ai)
        }
      >
        {yTicks.map((v) => (
          <React.Fragment key={v}>
            <Line x1={pad.l} x2={w - pad.r} y1={scales.y(v)} y2={scales.y(v)} stroke={theme.colors.border} strokeWidth={1} />
            <SvgText x={pad.l - 6} y={scales.y(v) + 4} fontSize={12} fontFamily={FONT.medium} fill={theme.colors.fg3} textAnchor="end">
              {`${v}°`}
            </SvgText>
          </React.Fragment>
        ))}
        {points.length > 1 ? (
          <>
            <Path d={bandPath(points, scales)} fill={band} />
            <Path d={linePath(points, (p) => p.temperatureNwp, scales)} stroke={nwpColor} strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
            <Path d={linePath(points, (p) => p.temperature, scales)} stroke={aiColor} strokeWidth={2} fill="none" strokeLinejoin="round" />
          </>
        ) : null}
        {xTicks.map(({ p, i }) => (
          <SvgText key={p.time} x={scales.x(i)} y={height - 6} fontSize={12} fontFamily={FONT.medium} fill={theme.colors.fg3} textAnchor={i === 0 ? 'start' : 'middle'}>
            {formatHour(p.time, locale)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

function LegendItem({ color, label, dashed, soft }: { color: string; label: string; dashed?: boolean; soft?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: soft ? tint(color, 0.3) : color, height: soft ? 10 : 2 },
          dashed && { backgroundColor: 'transparent', borderTopWidth: 2, borderStyle: 'dashed', borderColor: color, height: 0 },
        ]}
      />
      <Text style={[type.label, { color: theme.colors.fg2 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, borderRadius: 2 },
});
