import { useColorScheme } from 'react-native';

export const ACCENT = '#03c75a'; // Naver green

export interface Theme {
  dark: boolean;
  colors: {
    accent: string;
    accentSoft: string;
    background: string;
    card: string;
    cardAlt: string;
    text: string;
    textMuted: string;
    textFaint: string;
    border: string;
    track: string;
    danger: string;
    warning: string;
    info: string;
    tabBar: string;
    overlay: string;
  };
  radius: { sm: number; md: number; lg: number; pill: number };
  spacing: (n: number) => number;
}

const base = {
  radius: { sm: 8, md: 14, lg: 20, pill: 999 },
  spacing: (n: number) => n * 4,
};

export const lightTheme: Theme = {
  dark: false,
  colors: {
    accent: ACCENT,
    accentSoft: '#e6f9ee',
    background: '#f4f6f8',
    card: '#ffffff',
    cardAlt: '#f0f3f6',
    text: '#1a1d21',
    textMuted: '#5b6672',
    textFaint: '#9aa3ad',
    border: '#e3e7eb',
    track: '#e9edf1',
    danger: '#e5484d',
    warning: '#f5b400',
    info: '#1e88e5',
    tabBar: '#ffffff',
    overlay: 'rgba(0,0,0,0.04)',
  },
  ...base,
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    accent: '#19d96b',
    accentSoft: '#0f2d1c',
    background: '#0f1215',
    card: '#181c21',
    cardAlt: '#20262c',
    text: '#f1f3f5',
    textMuted: '#aab3bd',
    textFaint: '#6f7a86',
    border: '#272d34',
    track: '#2a3138',
    danger: '#ff6b70',
    warning: '#ffc533',
    info: '#5aa9f0',
    tabBar: '#15191d',
    overlay: 'rgba(255,255,255,0.06)',
  },
  ...base,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export const typography = {
  hero: { fontSize: 72, fontWeight: '200' as const, letterSpacing: -2 },
  title: { fontSize: 22, fontWeight: '700' as const },
  section: { fontSize: 15, fontWeight: '700' as const, letterSpacing: 0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '500' as const },
};
