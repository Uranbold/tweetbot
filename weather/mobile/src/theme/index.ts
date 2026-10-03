/**
 * Skycast design tokens — mirrors docs/UX.md §3.2–3.6. Dark values are selected, not inverted.
 * Components never use literal colours; they read from `useTheme()`.
 */
import { useColorScheme, type TextStyle } from 'react-native';
import type { AirGrade, AlertSeverity, IndexLevel, ModelId } from '@contract';

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  fg: string;
  fg2: string;
  fg3: string;
  accent: string;
  accentInk: string;
  accentTint: string;
  focus: string;
  grade: Record<AirGrade, string>;
  severity: Record<AlertSeverity, string>;
  indexLevel: Record<IndexLevel, string>;
  chart: Record<ModelId, string>;
  /** Rain / cold tone for icons (§3.7). */
  cold: string;
  /** Sun / warm tone for icons. */
  warm: string;
}

export interface Theme {
  dark: boolean;
  colors: ThemeColors;
  /** Cards 16, buttons/inputs 10, chips 999 (§3.6). */
  radius: { card: number; button: number; input: number; chip: number };
  /** 4 px grid. */
  space: { 1: number; 2: number; 3: number; 4: number; 6: number; 8: number; 12: number };
  /** Hairline border on light, none on dark. */
  cardBorderWidth: number;
}

const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 } as const;
const radius = { card: 16, button: 10, input: 10, chip: 999 } as const;

export const lightTheme: Theme = {
  dark: false,
  colors: {
    bg: '#f3f5f8',
    surface: '#ffffff',
    surface2: '#eaeef3',
    border: '#dde3ea',
    fg: '#121821',
    fg2: '#4b5563',
    fg3: '#7b8794',
    accent: '#03a84e',
    accentInk: '#ffffff',
    accentTint: '#e3f7ea',
    focus: '#2a78d6',
    grade: { good: '#2a78d6', moderate: '#1a9e4b', bad: '#e0860a', 'very-bad': '#c7322e' },
    severity: { advisory: '#b26a00', warning: '#c7322e' },
    indexLevel: { 'very-low': '#cfeedb', low: '#9edbb6', moderate: '#5fc48c', high: '#1a9e4b', 'very-high': '#0b6b31' },
    chart: {
      ecmwf: '#2a78d6',
      gfs: '#eb6834',
      icon: '#1baf7a',
      jma: '#eda100',
      kma: '#e87ba4',
      gem: '#008300',
      meteofrance: '#4a3aa7',
    },
    cold: '#2a78d6',
    warm: '#eda100',
  },
  radius,
  space,
  cardBorderWidth: 1,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    bg: '#0f1216',
    surface: '#171b21',
    surface2: '#1f252d',
    border: '#2a323c',
    fg: '#f2f5f8',
    fg2: '#aab4c0',
    fg3: '#76828f',
    accent: '#2fd072',
    accentInk: '#06240f',
    accentTint: '#12331f',
    focus: '#6fa8f0',
    grade: { good: '#4a90e8', moderate: '#3fb760', bad: '#e89a2a', 'very-bad': '#e05a52' },
    severity: { advisory: '#e0a430', warning: '#e05a52' },
    indexLevel: { 'very-low': '#1d3a28', low: '#215b36', moderate: '#2a8a4e', high: '#3fb760', 'very-high': '#7fe6a3' },
    chart: {
      ecmwf: '#3987e5',
      gfs: '#d95926',
      icon: '#199e70',
      jma: '#c98500',
      kma: '#d55181',
      gem: '#008300',
      meteofrance: '#9085e9',
    },
    cold: '#6fa8f0',
    warm: '#eda100',
  },
  radius,
  space,
  cardBorderWidth: 0,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/** 12 % alpha tint of a hex colour (chip grounds, bands). */
export function tint(hex: string, alpha = 0.12): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1] ?? '0', 16)}, ${parseInt(m[2] ?? '0', 16)}, ${parseInt(m[3] ?? '0', 16)}, ${alpha})`;
}

// ---------- Typography (§3.5) ----------

export const FONT = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

/** Mobile type scale: 12 · 14 · 16 · 18 · 22 · 28 · 64. */
export const SIZE = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 64 } as const;

const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  /** Hero temperature: 64 / 800 / -0.04em, tabular. */
  hero: { fontFamily: FONT.extrabold, fontSize: SIZE.hero, lineHeight: 68, letterSpacing: -0.04 * SIZE.hero, ...TABULAR } as TextStyle,
  display: { fontFamily: FONT.extrabold, fontSize: SIZE.xxl, lineHeight: 34, letterSpacing: -0.02 * SIZE.xxl, ...TABULAR } as TextStyle,
  title: { fontFamily: FONT.extrabold, fontSize: SIZE.xl, lineHeight: 28, letterSpacing: -0.01 * SIZE.xl } as TextStyle,
  heading: { fontFamily: FONT.semibold, fontSize: SIZE.lg, lineHeight: 24 } as TextStyle,
  body: { fontFamily: FONT.regular, fontSize: SIZE.md, lineHeight: 23 } as TextStyle,
  bodyStrong: { fontFamily: FONT.semibold, fontSize: SIZE.md, lineHeight: 23 } as TextStyle,
  small: { fontFamily: FONT.regular, fontSize: SIZE.sm, lineHeight: 20 } as TextStyle,
  smallStrong: { fontFamily: FONT.semibold, fontSize: SIZE.sm, lineHeight: 20 } as TextStyle,
  /** Data labels / axes: 12 / 500 / tabular / fg3. */
  label: { fontFamily: FONT.medium, fontSize: SIZE.xs, lineHeight: 16, ...TABULAR } as TextStyle,
  /** Uppercase eyebrow: 11 / 600 / 0.08em. */
  eyebrow: { fontFamily: FONT.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.08 * 11, textTransform: 'uppercase' } as TextStyle,
  /** Numbers set in tabular figures. */
  num: TABULAR,
};

// ---------- Motion (§3.8) ----------

export const MOTION = { hover: 120, enter: 200, sheet: 320, stagger: 40 } as const;
