import { readJson, writeJson } from './storage';

export type ThemeChoice = 'system' | 'light' | 'dark';
export const THEME_KEY = 'skycast:theme';

export function readTheme(): ThemeChoice {
  const v = readJson<unknown>(THEME_KEY, 'system');
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** "system" removes the attribute so prefers-color-scheme decides. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function saveTheme(choice: ThemeChoice): void {
  writeJson(THEME_KEY, choice);
  applyTheme(choice);
}
