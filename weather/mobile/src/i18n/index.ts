import { useDeviceStore } from '@/store/DeviceProvider';
import { DICTIONARIES, type Dictionary } from './dictionaries';
import type { Locale } from './types';

export type { Dictionary } from './dictionaries';
export type { Locale } from './types';
export { LOCALES } from './types';

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}

/** Dictionary for the locale stored in notification preferences (falls back to en). */
export function useT(): Dictionary {
  const { state } = useDeviceStore();
  return getDictionary(state.preferences.locale);
}

export function useLocale(): Locale {
  const { state } = useDeviceStore();
  return state.preferences.locale;
}
