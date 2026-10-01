import React from 'react';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { ConditionKey } from '@contract';
import { useTheme } from '@/theme';

export interface WeatherIconProps {
  condition: ConditionKey;
  isDay?: boolean;
  size?: number;
  testID?: string;
  /** Accessible name; defaults to the condition key. */
  label?: string;
}

const CLOUD_ALPHA = 0.55;

/**
 * Condition icon set (§3.7): 24 px grid, 1.75 px stroke, two tones — `fg` for clouds (currentColor),
 * warm accent for the sun, `focus`/cold blue for rain/snow. Keyed by ConditionKey with day/night variants.
 */
export function WeatherIcon({ condition, isDay = true, size = 48, testID, label }: WeatherIconProps) {
  const t = useTheme();
  const fg = t.colors.fg;
  const cold = t.colors.cold;
  const warm = t.colors.warm;
  const sw = 1.75;

  const sun = (
    <G>
      <Circle cx={9} cy={9} r={3.2} stroke={warm} strokeWidth={sw} fill="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        return <Line key={a} x1={9 + Math.cos(r) * 5} y1={9 + Math.sin(r) * 5} x2={9 + Math.cos(r) * 6.8} y2={9 + Math.sin(r) * 6.8} stroke={warm} strokeWidth={sw} strokeLinecap="round" />;
      })}
    </G>
  );
  const moon = <Path d="M12.5 4.5 A5.5 5.5 0 1 0 15.5 14 A4.5 4.5 0 0 1 12.5 4.5 Z" stroke={warm} strokeWidth={sw} fill="none" strokeLinejoin="round" />;
  const body = isDay ? sun : moon;

  const cloud = (x: number, y: number, s: number, alpha = 1) => (
    <Path
      d={`M ${x + 4 * s} ${y} H ${x + 14 * s} A ${3.4 * s} ${3.4 * s} 0 0 0 ${x + 14.2 * s} ${y - 6.8 * s} A ${4.6 * s} ${4.6 * s} 0 0 0 ${x + 5.6 * s} ${y - 7.2 * s} A ${3.6 * s} ${3.6 * s} 0 0 0 ${x + 4 * s} ${y} Z`}
      stroke={fg}
      strokeWidth={sw}
      fill={t.colors.surface}
      opacity={alpha}
      strokeLinejoin="round"
    />
  );
  const drops = (x: number, y: number, n: number, long = false) => (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <Line key={i} x1={x + i * 4} y1={y} x2={x + i * 4 - 1} y2={y + (long ? 4 : 2.5)} stroke={cold} strokeWidth={sw} strokeLinecap="round" />
      ))}
    </G>
  );
  const flakes = (x: number, y: number, n: number) => (
    <G>
      {Array.from({ length: n }, (_, i) => (
        <G key={i}>
          <Line x1={x + i * 4.5} y1={y - 1.6} x2={x + i * 4.5} y2={y + 1.6} stroke={cold} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={x + i * 4.5 - 1.5} y1={y - 0.8} x2={x + i * 4.5 + 1.5} y2={y + 0.8} stroke={cold} strokeWidth={1.4} strokeLinecap="round" />
          <Line x1={x + i * 4.5 + 1.5} y1={y - 0.8} x2={x + i * 4.5 - 1.5} y2={y + 0.8} stroke={cold} strokeWidth={1.4} strokeLinecap="round" />
        </G>
      ))}
    </G>
  );

  let content: React.ReactNode;
  switch (condition) {
    case 'clear':
      content = <G transform="translate(3 3)">{body}</G>;
      break;
    case 'mostly-clear':
      content = (
        <G>
          <G transform="translate(1.5 1.5)">{body}</G>
          {cloud(8, 19, 0.9)}
        </G>
      );
      break;
    case 'partly-cloudy':
      content = (
        <G>
          <G transform="translate(0.5 0.5)">{body}</G>
          {cloud(6, 20, 1.05)}
        </G>
      );
      break;
    case 'cloudy':
      content = (
        <G>
          {cloud(8, 13, 0.75, CLOUD_ALPHA)}
          {cloud(4, 20, 1.1)}
        </G>
      );
      break;
    case 'fog':
      content = (
        <G>
          {cloud(5, 13, 0.95)}
          {[16.5, 19.5, 22.5].map((yy, i) => (
            <Line key={i} x1={5 + i} y1={yy} x2={19 - i} y2={yy} stroke={fg} strokeWidth={sw} strokeLinecap="round" opacity={0.7} />
          ))}
        </G>
      );
      break;
    case 'drizzle':
      content = (
        <G>
          {cloud(4, 14, 1.05)}
          {drops(8, 17, 3)}
        </G>
      );
      break;
    case 'rain':
      content = (
        <G>
          {cloud(4, 14, 1.05)}
          {drops(7, 17, 4, true)}
        </G>
      );
      break;
    case 'heavy-rain':
      content = (
        <G>
          {cloud(4, 13, 1.05)}
          {drops(6, 16, 4, true)}
          {drops(8, 20.5, 3, true)}
        </G>
      );
      break;
    case 'freezing-rain':
    case 'sleet':
      content = (
        <G>
          {cloud(4, 14, 1.05)}
          {drops(7, 17, 2, true)}
          {flakes(16, 19, 1)}
        </G>
      );
      break;
    case 'snow':
      content = (
        <G>
          {cloud(4, 14, 1.05)}
          {flakes(7.5, 19, 3)}
        </G>
      );
      break;
    case 'heavy-snow':
      content = (
        <G>
          {cloud(4, 13, 1.05)}
          {flakes(6.5, 17.5, 3)}
          {flakes(9, 21.5, 2)}
        </G>
      );
      break;
    case 'thunderstorm':
      content = (
        <G>
          {cloud(4, 13, 1.05)}
          <Path d="M13 14 L10 19 H12.5 L11 23 L15.5 17.5 H13 L14.5 14 Z" fill={warm} stroke={warm} strokeWidth={0.5} strokeLinejoin="round" />
          {drops(6, 16.5, 2, true)}
        </G>
      );
      break;
    default:
      content = <G transform="translate(3 3)">{body}</G>;
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      testID={testID ?? `weather-icon-${condition}`}
      accessibilityLabel={label ?? `${condition}${isDay ? '' : ' night'}`}
    >
      {content}
    </Svg>
  );
}
