import type { AlertSeverity, AlertType, HazardRisk, NotificationKind, Region, WeatherAlert } from '@contract';
import { formatClock, formatProbability, formatShortDate, roundTemp } from '@/lib/format';
import { regionDeepLink } from '@/lib/deepLink';
import { BRIEFING_CHANNEL_ID, WEATHER_ALERTS_CHANNEL_ID } from './channels';

/**
 * Notification copy templates (UX §4.10). The backend dispatcher owns the real messages; the app uses
 * these for local/demo notifications and keeps them within the same limits:
 * title ≤ 40 chars ("⚠ Cold-wave warning · Khovd"), body ≤ 110 chars, always a deep link.
 */
export const TITLE_MAX = 40;
export const BODY_MAX = 110;

export interface LocalNotificationContent {
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
  sound: boolean;
}

const HAZARD_WORD: Record<AlertType, string> = {
  'heat-wave': 'Heat-wave',
  'cold-wave': 'Cold-wave',
  'heavy-rain': 'Heavy-rain',
  'heavy-snow': 'Heavy-snow',
  'strong-wind': 'Strong-wind',
  dry: 'Dry-weather',
  'fine-dust': 'Fine-dust',
  typhoon: 'Typhoon',
};

const ADVICE: Record<AlertType, string> = {
  'heat-wave': 'Drink water; avoid midday sun.',
  'cold-wave': 'Dress in layers; limit time outside.',
  'heavy-rain': 'Avoid low roads; take an umbrella.',
  'heavy-snow': 'Allow extra travel time.',
  'strong-wind': 'Secure loose objects; drive carefully.',
  dry: 'No open flames outdoors.',
  'fine-dust': 'Wear a mask; limit outdoor activity.',
  typhoon: 'Stay indoors; follow local guidance.',
};

export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function severityGlyph(severity: AlertSeverity): string {
  return severity === 'warning' ? '⚠' : '▲';
}

export function alertTitle(type: AlertType, severity: AlertSeverity, regionName: string): string {
  return clip(`${severityGlyph(severity)} ${HAZARD_WORD[type]} ${severity} · ${regionName}`, TITLE_MAX);
}

/** "Min −18 °C expected Thu 06:00–09:00. Dress in layers; limit time outside." */
export function alertBody(alert: Pick<WeatherAlert, 'type' | 'description' | 'start' | 'end'>): string {
  const when = alert.end ? `${formatShortDate(alert.start)} ${formatClock(alert.start)}–${formatClock(alert.end)}` : `${formatShortDate(alert.start)} ${formatClock(alert.start)}`;
  return clip(`${alert.description} (${when}). ${ADVICE[alert.type]}`, BODY_MAX);
}

/** "72 % chance of a strong-wind advisory Fri (AI estimate)" — always probabilistic, never "will". */
export function aiRiskBody(risk: Pick<HazardRisk, 'hazard' | 'severity' | 'probability' | 'expectedStart'>): string {
  const day = risk.expectedStart ? ` ${formatShortDate(risk.expectedStart)}` : '';
  return clip(`${formatProbability(risk.probability)} chance of a ${HAZARD_WORD[risk.hazard].toLowerCase()} ${risk.severity}${day} (AI estimate). ${ADVICE[risk.hazard]}`, BODY_MAX);
}

export function briefingTitle(regionName: string, min: number, max: number): string {
  return clip(`${regionName} today: ${roundTemp(max)} / ${roundTemp(min)}`, TITLE_MAX);
}

export function channelFor(kind: NotificationKind): string {
  return kind === 'daily-briefing' ? BRIEFING_CHANNEL_ID : WEATHER_ALERTS_CHANNEL_ID;
}

/** Content for the local "test alert" the Settings dev button schedules. */
export function buildLocalTestAlert(region: Pick<Region, 'id' | 'name'>): LocalNotificationContent {
  const alert: Pick<WeatherAlert, 'type' | 'description' | 'start' | 'end'> = {
    type: 'cold-wave',
    description: 'Min −18 °C expected',
    start: '2026-10-03T06:00',
    end: '2026-10-03T09:00',
  };
  return {
    title: alertTitle('cold-wave', 'warning', region.name),
    body: alertBody(alert),
    data: {
      kind: 'test',
      regionId: region.id,
      deepLink: regionDeepLink(region.id, true),
      severity: 'warning',
      dedupKey: `test:${region.id}:${Date.now()}`,
    },
    channelId: channelFor('test'),
    sound: true,
  };
}
