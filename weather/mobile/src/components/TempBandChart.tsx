import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { PredictedHourly } from '@contract';
import { formatHour } from '@/lib/format';
import type { Locale } from '@/i18n/types';
import { useTheme } from '@/theme';

export interface TempBandChartProps {
  hourly: PredictedHourly[];
  locale: Locale;
  labels: { ai: string; nwp: string; band: string };
  height?: number;
  hours?: number;
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
  const lower = [...points]
    .map((p, i) => ({ p, i }))
    .reverse()
    .map(({ p, i }) => `L ${s.x(i).toFixed(1)} ${s.y(p.temperatureP10).toFixed(1)}`);
  return `${upper.join(' ')} ${lower.join(' ')} Z`;
}

/** AI temperature with P10–P90 band vs raw NWP dashed line. */
export function TempBandChart({ hourly, locale, labels, height = 180, hours = 48 }: TempBandChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const points = useMemo(() => hourly.slice(0, hours), [hourly, hours]);
  const pad = { l: 30, r: 8, t: 10, b: 22 };
  const scales = useMemo(() => buildScales(points, width || 320, height, pad), [points, width, height]); // eslint-disable-line react-hooks/exhaustive-deps

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const w = width || 320;

  const yTicks = useMemo(() => {
    const span = scales.max - scales.min;
    const step = span > 30 ? 10 : span > 12 ? 5 : 2;
    const start = Math.ceil(scales.min / step) * step;
    const ticks: number[] = [];
    for (let v = start; v <= scales.max; v += step) ticks.push(v);
    return ticks;
  }, [scales]);

  const xTicks = useMemo(() => points.map((p, i) => ({ p, i })).filter(({ i }) => i % 6 === 0), [points]);

  const aiColor = theme.colors.accent;
  const nwpColor = theme.colors.textMuted;

  return (
    <View onLayout={onLayout} testID="temp-band-chart">
      <Svg width={w} height={height}>
        {yTicks.map((v) => (
          <React.Fragment key={v}>
            <Line x1={pad.l} x2={w - pad.r} y1={scales.y(v)} y2={scales.y(v)} stroke={theme.colors.border} strokeWidth={1} />
            <SvgText x={pad.l - 6} y={scales.y(v) + 4} fontSize={10} fill={theme.colors.textFaint} textAnchor="end">
              {`${v}°`}
            </SvgText>
          </React.Fragment>
        ))}
        {points.length > 1 ? (
          <>
            <Path d={bandPath(points, scales)} fill={aiColor} opacity={0.18} />
            <Path d={linePath(points, (p) => p.temperatureNwp, scales)} stroke={nwpColor} strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
            <Path d={linePath(points, (p) => p.temperature, scales)} stroke={aiColor} strokeWidth={2.4} fill="none" strokeLinejoin="round" />
          </>
        ) : null}
        {xTicks.map(({ p, i }) => (
          <SvgText key={p.time} x={scales.x(i)} y={height - 6} fontSize={10} fill={theme.colors.textFaint} textAnchor={i === 0 ? 'start' : 'middle'}>
            {formatHour(p.time, locale)}
          </SvgText>
        ))}
      </Svg>
      <View style={styles.legend}>
        <LegendItem color={aiColor} label={labels.ai} />
        <LegendItem color={aiColor} label={labels.band} soft />
        <LegendItem color={nwpColor} label={labels.nwp} dashed />
      </View>
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
          { backgroundColor: soft ? `${color}44` : color, height: soft ? 10 : 3 },
          dashed && { backgroundColor: 'transparent', borderTopWidth: 2, borderStyle: 'dashed', borderColor: color, height: 0 },
        ]}
      />
      <Text style={[styles.legendText, { color: theme.colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6, paddingLeft: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, borderRadius: 2 },
  legendText: { fontSize: 12 },
});
