import React from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { ConditionKey } from '@contract';

export interface WeatherIconProps {
  condition: ConditionKey;
  isDay?: boolean;
  size?: number;
  testID?: string;
}

const SUN = '#f5b400';
const MOON = '#c9d2dd';
const CLOUD = '#b8c2cc';
const CLOUD_DARK = '#8a96a3';
const RAIN = '#1e88e5';
const SNOW = '#7fb6ff';
const BOLT = '#ffb300';
const FOG = '#a9b4bf';

function Sun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <G>
      {rays.map((a, i) => (
        <Line
          key={i}
          x1={cx + Math.cos(a) * (r + 3)}
          y1={cy + Math.sin(a) * (r + 3)}
          x2={cx + Math.cos(a) * (r + 7)}
          y2={cy + Math.sin(a) * (r + 7)}
          stroke={SUN}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ))}
      <Circle cx={cx} cy={cy} r={r} fill={SUN} />
    </G>
  );
}

function Moon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <Path
      d={`M ${cx + r * 0.2} ${cy - r} A ${r} ${r} 0 1 0 ${cx + r * 0.2} ${cy + r} A ${r * 0.78} ${r * 0.78} 0 1 1 ${cx + r * 0.2} ${cy - r} Z`}
      fill={MOON}
    />
  );
}

function Cloud({ x, y, s, color = CLOUD }: { x: number; y: number; s: number; color?: string }) {
  // Simple cloud silhouette scaled by s, anchored at (x, y) bottom-left.
  return (
    <Path
      d={`M ${x + 6 * s} ${y}
          H ${x + 30 * s}
          A ${7 * s} ${7 * s} 0 0 0 ${x + 30 * s} ${y - 14 * s}
          A ${9 * s} ${9 * s} 0 0 0 ${x + 13 * s} ${y - 16 * s}
          A ${7 * s} ${7 * s} 0 0 0 ${x + 6 * s} ${y}
          Z`}
      fill={color}
    />
  );
}

function Drops({ x, y, n, color, long }: { x: number; y: number; n: number; color: string; long?: boolean }) {
  return (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <Line
          key={i}
          x1={x + i * 7}
          y1={y}
          x2={x + i * 7 - 2}
          y2={y + (long ? 9 : 6)}
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ))}
    </G>
  );
}

function Flakes({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <G key={i}>
          <Circle cx={x + i * 8} cy={y + (i % 2) * 4} r={1.8} fill={SNOW} />
          <Circle cx={x + i * 8} cy={y + (i % 2) * 4} r={3.2} stroke={SNOW} strokeWidth={0.8} fill="none" />
        </G>
      ))}
    </G>
  );
}

export function WeatherIcon({ condition, isDay = true, size = 48, testID }: WeatherIconProps) {
  const body = isDay ? <Sun cx={18} cy={18} r={8} /> : <Moon cx={18} cy={18} r={8} />;
  let content: React.ReactNode;
  switch (condition) {
    case 'clear':
      content = body;
      break;
    case 'mostly-clear':
      content = (
        <G>
          {body}
          <Cloud x={14} y={40} s={0.8} />
        </G>
      );
      break;
    case 'partly-cloudy':
      content = (
        <G>
          {body}
          <Cloud x={10} y={42} s={1} />
        </G>
      );
      break;
    case 'cloudy':
      content = (
        <G>
          <Cloud x={14} y={30} s={0.8} color={CLOUD_DARK} />
          <Cloud x={6} y={40} s={1.05} />
        </G>
      );
      break;
    case 'fog':
      content = (
        <G>
          <Cloud x={8} y={30} s={1} />
          {[36, 41, 46].map((yy, i) => (
            <Line key={i} x1={8 + i * 2} y1={yy} x2={40 - i * 2} y2={yy} stroke={FOG} strokeWidth={2} strokeLinecap="round" />
          ))}
        </G>
      );
      break;
    case 'drizzle':
      content = (
        <G>
          <Cloud x={8} y={32} s={1} />
          <Drops x={16} y={36} n={3} color={RAIN} />
        </G>
      );
      break;
    case 'rain':
      content = (
        <G>
          <Cloud x={8} y={32} s={1} color={CLOUD_DARK} />
          <Drops x={14} y={36} n={4} color={RAIN} long />
        </G>
      );
      break;
    case 'heavy-rain':
      content = (
        <G>
          <Cloud x={8} y={30} s={1} color={CLOUD_DARK} />
          <Drops x={12} y={34} n={5} color={RAIN} long />
          <Drops x={15} y={42} n={4} color={RAIN} />
        </G>
      );
      break;
    case 'freezing-rain':
    case 'sleet':
      content = (
        <G>
          <Cloud x={8} y={32} s={1} color={CLOUD_DARK} />
          <Drops x={13} y={36} n={2} color={RAIN} long />
          <Flakes x={30} y={38} n={2} />
        </G>
      );
      break;
    case 'snow':
      content = (
        <G>
          <Cloud x={8} y={32} s={1} />
          <Flakes x={14} y={38} n={3} />
        </G>
      );
      break;
    case 'heavy-snow':
      content = (
        <G>
          <Cloud x={8} y={30} s={1} color={CLOUD_DARK} />
          <Flakes x={12} y={35} n={4} />
          <Flakes x={16} y={42} n={3} />
        </G>
      );
      break;
    case 'thunderstorm':
      content = (
        <G>
          <Cloud x={8} y={30} s={1} color={CLOUD_DARK} />
          <Path d="M 26 31 L 20 41 L 25 41 L 22 48 L 31 37 L 26 37 L 29 31 Z" fill={BOLT} />
          <Drops x={12} y={34} n={2} color={RAIN} />
        </G>
      );
      break;
    default:
      content = body;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" testID={testID ?? `weather-icon-${condition}`}>
      {content}
    </Svg>
  );
}
