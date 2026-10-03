import type { NotificationPreferences } from '@contract';

export type Locale = NotificationPreferences['locale'];
export const LOCALES: Locale[] = ['en', 'mn', 'ko'];
