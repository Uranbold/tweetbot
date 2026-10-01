import type { HourlyPoint, TodayWeather } from '@contract';
import { datePart, formatHour, relativeDayLabel } from './format';

/**
 * UX §6 "lead with the decision": a one-line, actionable takeaway derived from the forecast.
 * Rain in the next 36 h wins; otherwise wind, then the clothing advice.
 */
export function decisionLine(w: Pick<TodayWeather, 'hourly' | 'current' | 'clothing'>): string {
  const next24: HourlyPoint[] = w.hourly.slice(0, 36);
  const today = datePart(w.current.time);
  const wet = next24.find((h) => h.precipitationProbability >= 50 && (h.snowfall > 0 || h.precipitation >= 0.1));
  if (wet) {
    const day = relativeDayLabel(datePart(wet.time), today);
    const when = `${day === 'Today' ? '' : `${day.toLowerCase() === 'tomorrow' ? 'tomorrow' : day} `}from ${formatHour(wet.time)}`;
    return wet.snowfall > 0 ? `Expect snow ${when}` : `Take an umbrella ${when}`;
  }
  const gust = Math.max(w.current.windGust, ...next24.map((h) => h.windSpeed));
  if (gust >= 14) return 'Strong wind today — secure loose items';
  return w.clothing.summary ? `Wear: ${w.clothing.summary.charAt(0).toLowerCase()}${w.clothing.summary.slice(1)}` : '';
}
