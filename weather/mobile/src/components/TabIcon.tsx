import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type TabIconName = 'today' | 'ai' | 'alerts' | 'settings';

/** Bottom-tab glyphs: 24 px grid, 1.75 px stroke (§3.7). */
export function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: string; size?: number }) {
  const sw = 1.75;
  switch (name) {
    case 'today':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="today">
          <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={sw} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return <Line key={a} x1={12 + Math.cos(r) * 7} y1={12 + Math.sin(r) * 7} x2={12 + Math.cos(r) * 9.5} y2={12 + Math.sin(r) * 9.5} stroke={color} strokeWidth={sw} strokeLinecap="round" />;
          })}
        </Svg>
      );
    case 'ai':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="AI forecast">
          <Path d="M3 17 L8 11 L12 14 L17 7 L21 10" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M3 21 H21" stroke={color} strokeWidth={sw} strokeLinecap="round" opacity={0.5} />
          <Circle cx={17} cy={7} r={2} fill={color} />
        </Svg>
      );
    case 'alerts':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="alerts">
          <Path d="M12 3.5 L22 20 H2 Z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Line x1={12} y1={10} x2={12} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={12} cy={17} r={1.1} fill={color} />
        </Svg>
      );
    case 'settings':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="settings">
          <Line x1={4} y1={7} x2={20} y2={7} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={4} y1={17} x2={20} y2={17} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx={9} cy={7} r={2.2} fill={color} />
          <Circle cx={15} cy={12} r={2.2} fill={color} />
          <Circle cx={10} cy={17} r={2.2} fill={color} />
        </Svg>
      );
  }
}
