import type { AirGrade, AlertSeverity, AlertType, WeatherAlert } from '../types.js';
import { gradeAtLeast } from './air.js';
import { addDays } from '../lib/time.js';
import { round1 } from '../lib/geo.js';

/** BR-02 thresholds, held as data so Phase 2 can configure them per region. */
export const ALERT_THRESHOLDS = {
  heatWave: { advisory: 33, warning: 35, days: 2 }, // feels-like max °C
  coldWave: { advisory: -12, warning: -15, dropAdvisory: 10 }, // morning min °C / day-over-day drop
  heavyRain: { advisory: { h3: 60, h12: 110 }, warning: { h3: 90, h12: 180 } }, // mm
  heavySnow: { advisory: 5, warning: 20 }, // cm / 24 h
  strongWind: { advisory: { wind: 14, gust: 20 }, warning: { wind: 21, gust: 26 } }, // m/s
  fineDust: { advisory: 'bad' as AirGrade, warning: 'very-bad' as AirGrade, sustainedHours: 2 },
} as const;

export type AlertThresholds = typeof ALERT_THRESHOLDS;

export interface AlertHour {
  time: string;
  precipitation: number; // mm
  snowfall: number; // cm
  windSpeed: number; // m/s
  windGust: number; // m/s
}

export interface AlertDay {
  date: string;
  temperatureMin: number;
  feelsLikeMax: number;
}

export interface AlertAirHour {
  time: string;
  grade: AirGrade;
}

export interface AlertInput {
  /** Forecast hours from the current hour onwards (the horizon is the caller's choice, typically 72 h). */
  hourly: readonly AlertHour[];
  /** Daily values; may start with past days (needed for the day-over-day drop). */
  daily: readonly AlertDay[];
  /** First date to evaluate daily rules from (local "YYYY-MM-DD"). */
  fromDate: string;
  /** Last date (inclusive) to evaluate daily rules for. */
  toDate: string;
  air?: readonly AlertAirHour[] | null;
}

export const HAZARD_LABEL: Record<AlertType, string> = {
  'heat-wave': 'Heat wave',
  'cold-wave': 'Cold wave',
  'heavy-rain': 'Heavy rain',
  'heavy-snow': 'Heavy snow',
  'strong-wind': 'Strong wind',
  dry: 'Dry weather',
  'fine-dust': 'Fine dust',
  typhoon: 'Typhoon',
};

function alert(type: AlertType, severity: AlertSeverity, description: string, start: string, end?: string): WeatherAlert {
  const a: WeatherAlert = { type, severity, title: `${HAZARD_LABEL[type]} ${severity}`, description, start, source: 'derived' };
  if (end) a.end = end;
  return a;
}

const dayStart = (date: string) => `${date}T00:00`;
const dayEnd = (date: string) => `${addDays(date, 1)}T00:00`;

function heatWave(input: AlertInput, t: AlertThresholds): WeatherAlert | null {
  const days = input.daily.filter((d) => d.date >= input.fromDate && d.date <= input.toDate);
  const run = (threshold: number) => {
    for (let i = 0; i + t.heatWave.days - 1 < days.length; i++) {
      const window = days.slice(i, i + t.heatWave.days);
      if (window.every((d) => d.feelsLikeMax >= threshold)) {
        let j = i + t.heatWave.days;
        while (j < days.length && days[j]!.feelsLikeMax >= threshold) j++;
        const span = days.slice(i, j);
        return { span, peak: Math.max(...span.map((d) => d.feelsLikeMax)) };
      }
    }
    return null;
  };
  for (const severity of ['warning', 'advisory'] as const) {
    const threshold = t.heatWave[severity];
    const r = run(threshold);
    if (r) {
      return alert('heat-wave', severity,
        `Feels-like maximum ≥ ${threshold}°C on ${r.span.length} consecutive days (peak ${round1(r.peak)}°C)`,
        dayStart(r.span[0]!.date), dayEnd(r.span[r.span.length - 1]!.date));
    }
  }
  return null;
}

function coldWave(input: AlertInput, t: AlertThresholds): WeatherAlert | null {
  let advisory: WeatherAlert | null = null;
  for (let i = 0; i < input.daily.length; i++) {
    const d = input.daily[i]!;
    if (d.date < input.fromDate || d.date > input.toDate) continue;
    if (d.temperatureMin <= t.coldWave.warning) {
      return alert('cold-wave', 'warning', `Morning minimum of ${round1(d.temperatureMin)}°C (≤ ${t.coldWave.warning}°C)`, dayStart(d.date), dayEnd(d.date));
    }
    if (advisory) continue;
    const prev = input.daily[i - 1];
    const drop = prev ? prev.temperatureMin - d.temperatureMin : 0;
    if (d.temperatureMin <= t.coldWave.advisory) {
      advisory = alert('cold-wave', 'advisory', `Morning minimum of ${round1(d.temperatureMin)}°C (≤ ${t.coldWave.advisory}°C)`, dayStart(d.date), dayEnd(d.date));
    } else if (drop >= t.coldWave.dropAdvisory) {
      advisory = alert('cold-wave', 'advisory', `Morning minimum drops ${round1(drop)}°C from the previous day (≥ ${t.coldWave.dropAdvisory}°C)`, dayStart(d.date), dayEnd(d.date));
    }
  }
  return advisory;
}

/** Maximum rolling sum over `width` consecutive hours, with its window. */
export function maxRollingSum(hours: readonly AlertHour[], width: number, pick: (h: AlertHour) => number) {
  let best = { sum: 0, start: 0, end: -1 };
  let acc = 0;
  for (let i = 0; i < hours.length; i++) {
    acc += pick(hours[i]!);
    if (i >= width) acc -= pick(hours[i - width]!);
    const start = Math.max(0, i - width + 1);
    if (acc > best.sum + 1e-9) best = { sum: acc, start, end: i };
  }
  return best;
}

const windowEnd = (hours: readonly AlertHour[], i: number) => hours[i]!.time.slice(0, 11) + `${hours[i]!.time.slice(11, 13)}:59`;

function heavyRain(input: AlertInput, t: AlertThresholds): WeatherAlert | null {
  const h3 = maxRollingSum(input.hourly, 3, (h) => h.precipitation);
  const h12 = maxRollingSum(input.hourly, 12, (h) => h.precipitation);
  for (const severity of ['warning', 'advisory'] as const) {
    const th = t.heavyRain[severity];
    const hit = h3.sum >= th.h3 ? { w: h3, label: `${round1(h3.sum)} mm in 3 h (≥ ${th.h3} mm)` } :
      h12.sum >= th.h12 ? { w: h12, label: `${round1(h12.sum)} mm in 12 h (≥ ${th.h12} mm)` } : null;
    if (hit) return alert('heavy-rain', severity, `Up to ${hit.label}`, input.hourly[hit.w.start]!.time, windowEnd(input.hourly, hit.w.end));
  }
  return null;
}

function heavySnow(input: AlertInput, t: AlertThresholds): WeatherAlert | null {
  const w = maxRollingSum(input.hourly, 24, (h) => h.snowfall);
  for (const severity of ['warning', 'advisory'] as const) {
    const th = t.heavySnow[severity];
    if (w.sum >= th) {
      return alert('heavy-snow', severity, `Up to ${round1(w.sum)} cm of snow in 24 h (≥ ${th} cm)`, input.hourly[w.start]!.time, windowEnd(input.hourly, w.end));
    }
  }
  return null;
}

function strongWind(input: AlertInput, t: AlertThresholds): WeatherAlert | null {
  for (const severity of ['warning', 'advisory'] as const) {
    const th = t.strongWind[severity];
    const idx = input.hourly.map((h, i) => (h.windSpeed >= th.wind || h.windGust >= th.gust ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const span = idx.map((i) => input.hourly[i]!);
      const maxWind = Math.max(...span.map((h) => h.windSpeed));
      const maxGust = Math.max(...span.map((h) => h.windGust));
      return alert('strong-wind', severity,
        `Wind up to ${round1(maxWind)} m/s, gusts ${round1(maxGust)} m/s (threshold ${th.wind} m/s or gusts ${th.gust} m/s)`,
        span[0]!.time, windowEnd(input.hourly, idx[idx.length - 1]!));
    }
  }
  return null;
}

function fineDust(input: AlertInput, t: AlertThresholds): WeatherAlert | null {
  const air = input.air ?? [];
  const need = t.fineDust.sustainedHours;
  for (const severity of ['warning', 'advisory'] as const) {
    const grade = t.fineDust[severity];
    let runStart = -1;
    for (let i = 0; i <= air.length; i++) {
      const ok = i < air.length && gradeAtLeast(air[i]!.grade, grade);
      if (ok && runStart < 0) runStart = i;
      if (!ok && runStart >= 0) {
        if (i - runStart >= need) {
          const label = grade === 'very-bad' ? 'very bad' : grade;
          return alert('fine-dust', severity, `Air quality "${label}" or worse for ${i - runStart} consecutive hours (≥ ${need} h)`,
            air[runStart]!.time, `${air[i - 1]!.time.slice(0, 13)}:59`);
        }
        runStart = -1;
      }
    }
  }
  return null;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { warning: 0, advisory: 1 };

/** BR-02 derived alerts. At most one alert per hazard (the highest severity reached). */
export function deriveAlerts(input: AlertInput, thresholds: AlertThresholds = ALERT_THRESHOLDS): WeatherAlert[] {
  return [heatWave, coldWave, heavyRain, heavySnow, strongWind, fineDust]
    .map((rule) => rule(input, thresholds))
    .filter((a): a is WeatherAlert => a !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.start.localeCompare(b.start));
}

export function severityAtLeast(s: AlertSeverity, min: AlertSeverity): boolean {
  return SEVERITY_ORDER[s] <= SEVERITY_ORDER[min];
}
