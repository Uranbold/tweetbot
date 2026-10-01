import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { AirGrade } from '@contract';

/**
 * Inline SVG face glyphs for the 4-tier air grade (§3.3): ☺ good, 😐 moderate, 😷 bad, ☹ very-bad.
 * Drawn, not emoji, so they render identically on every platform.
 */
export function GradeFace({ grade, color, size = 16, testID }: { grade: AirGrade; color: string; size?: number; testID?: string }) {
  const sw = 1.75;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID ?? `grade-face-${grade}`} accessibilityLabel={`${grade} face`}>
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={sw} />
      {grade === 'bad' ? (
        <>
          {/* mask */}
          <Rect x={5.5} y={12} width={13} height={6.5} rx={2} fill={color} />
          <Line x1={5.5} y1={13.5} x2={2.5} y2={12} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={18.5} y1={13.5} x2={21.5} y2={12} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx={8.5} cy={9} r={1.4} fill={color} />
          <Circle cx={15.5} cy={9} r={1.4} fill={color} />
        </>
      ) : (
        <>
          <Circle cx={8.5} cy={9.5} r={1.4} fill={color} />
          <Circle cx={15.5} cy={9.5} r={1.4} fill={color} />
          {grade === 'good' ? (
            <Path d="M7.5 14.5 Q12 18.5 16.5 14.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          ) : grade === 'moderate' ? (
            <Line x1={8} y1={15.5} x2={16} y2={15.5} stroke={color} strokeWidth={sw} strokeLinecap="round" />
          ) : (
            <Path d="M7.5 17 Q12 13 16.5 17" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          )}
        </>
      )}
    </Svg>
  );
}
