/* eslint-disable @typescript-eslint/no-require-imports */
import '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Fonts are loaded by the root layout; components only reference font family names.
jest.mock('@expo-google-fonts/manrope', () => ({
  useFonts: () => [true, null],
  Manrope_400Regular: 1,
  Manrope_500Medium: 2,
  Manrope_600SemiBold: 3,
  Manrope_800ExtraBold: 4,
}));

// Keep motion deterministic in tests (reduced motion → count-up jumps immediately).
jest.mock('@/hooks/useMotion', () => {
  const actual = jest.requireActual('@/hooks/useMotion');
  return { ...actual, useReducedMotion: () => true, announce: jest.fn() };
});
