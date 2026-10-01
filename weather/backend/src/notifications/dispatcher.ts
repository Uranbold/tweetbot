/**
 * Notification dispatcher: for every region with ≥1 device, evaluate derived alerts (BR-02),
 * AI risks, air grade and the daily briefing; apply each device's preferences, quiet hours
 * and 24 h dedup; send through the PushSender; record history.
 */
import { randomUUID } from 'node:crypto';
import type { AlertSeverity, Device, NotificationKind, NotificationMessage, Region } from '../types.js';
import { gradeAtLeast } from '../domain/air.js';
import { severityAtLeast } from '../domain/alerts.js';
import { dateOf, hourOf, localTimeAt } from '../lib/time.js';
import type { RegionConditions } from '../services/regionAlertsService.js';
import type { RegionService } from '../services/regionService.js';
import * as t from './i18n.js';
import type { PushSender } from './push.js';
import type { DeviceRepository, NotificationHistoryRepository } from './repositories.js';

export type ConditionsSource = (region: Region) => Promise<RegionConditions>;

export interface DispatcherLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
}

export interface DispatchReport {
  startedAt: string;
  durationMs: number;
  regionsEvaluated: number;
  regionFailures: number;
  sent: NotificationMessage[];
  delivered: number;
  failed: number;
  suppressedDedup: number;
  suppressedQuietHours: number;
  devicesRemoved: number;
}

export interface DispatcherStats {
  runs: number;
  running: boolean;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastError: string | null;
  regionsEvaluated: number;
  messagesSent: number;
  delivered: number;
  failed: number;
  suppressedDedup: number;
  suppressedQuietHours: number;
  devicesRemoved: number;
}

const DEDUP_WINDOW_MS = 24 * 3_600_000;

/** Quiet window in local hours; start > end wraps midnight (e.g. 22 → 7). start === end disables. */
export function inQuietHours(hour: number, quiet: { start: number; end: number } | null): boolean {
  if (!quiet || quiet.start === quiet.end) return false;
  return quiet.start < quiet.end ? hour >= quiet.start && hour < quiet.end : hour >= quiet.start || hour < quiet.end;
}

export function dedupKey(regionId: string, kind: NotificationKind, subject: string, date: string): string {
  return `${regionId}:${kind}:${subject}:${date}`;
}

/** Regions a device should hear about: its subscriptions plus, when following location, the nearest region. */
export function effectiveRegionIds(device: Device, regions: RegionService): string[] {
  const ids = new Set(device.regionIds);
  if (device.followLocation && device.lastLocation) ids.add(regions.nearest(device.lastLocation).id);
  return [...ids];
}

interface Candidate {
  kind: NotificationKind;
  subject: string; // hazard | grade | "day"
  severity?: AlertSeverity;
  render: (locale: t.Locale) => { title: string; body: string };
  deepLink: string;
  data: Record<string, string>;
}

/** All candidate notifications a device could receive for a region right now. */
export function candidatesFor(device: Device, region: Region, cond: RegionConditions, localHour: number): Candidate[] {
  const p = device.preferences;
  const out: Candidate[] = [];
  const alertsLink = `skycast://region/${region.id}/alerts`;
  for (const a of cond.alerts) {
    if (!p.alertTypes.includes(a.type) || !severityAtLeast(a.severity, p.minSeverity)) continue;
    out.push({
      kind: 'alert',
      subject: a.type,
      severity: a.severity,
      render: (l) => ({ title: `${t.alertTitle(l, a.type, a.severity)} · ${region.name}`, body: a.description }),
      deepLink: alertsLink,
      data: { hazard: a.type, severity: a.severity, start: a.start, ...(a.end ? { end: a.end } : {}) },
    });
  }
  if (p.aiRiskThreshold > 0) {
    for (const r of cond.risks) {
      if (r.probability < p.aiRiskThreshold) continue;
      if (!p.alertTypes.includes(r.hazard) || !severityAtLeast(r.severity, p.minSeverity)) continue;
      out.push({
        kind: 'ai-risk',
        subject: r.hazard,
        severity: r.severity,
        render: (l) => ({ title: `${t.aiRiskTitle(l, r.hazard, r.probability)} · ${region.name}`, body: r.rationale }),
        deepLink: alertsLink,
        data: { hazard: r.hazard, severity: r.severity, probability: r.probability.toFixed(2), ...(r.expectedStart ? { expectedStart: r.expectedStart } : {}) },
      });
    }
  }
  const air = cond.air;
  if (p.airGradeThreshold && air && gradeAtLeast(air.overallGrade, p.airGradeThreshold)) {
    out.push({
      kind: 'air-quality',
      subject: air.overallGrade,
      render: (l) => ({ title: `${t.airTitle(l, air.overallGrade)} · ${region.name}`, body: t.airBody(l, region.name, air.pm10, air.pm25) }),
      deepLink: `skycast://region/${region.id}/air`,
      data: { grade: air.overallGrade, pm10: String(air.pm10), pm25: String(air.pm25) },
    });
  }
  if (p.dailyBriefingHour !== null && p.dailyBriefingHour === localHour) {
    out.push({
      kind: 'daily-briefing',
      subject: 'day',
      render: (l) => ({ title: t.briefingTitle(l, region.name), body: t.briefingBody(l, cond.headline, cond.temperatureMax, cond.temperatureMin) }),
      deepLink: `skycast://region/${region.id}`,
      data: {},
    });
  }
  return out;
}

export class Dispatcher {
  private readonly totals: Omit<DispatcherStats, 'running' | 'lastRunAt' | 'lastDurationMs' | 'lastError' | 'runs'> = {
    regionsEvaluated: 0, messagesSent: 0, delivered: 0, failed: 0, suppressedDedup: 0, suppressedQuietHours: 0, devicesRemoved: 0,
  };
  private runs = 0;
  private running = false;
  private lastRunAt: string | null = null;
  private lastDurationMs: number | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly deps: {
      devices: DeviceRepository;
      history: NotificationHistoryRepository;
      push: PushSender;
      regions: RegionService;
      conditions: ConditionsSource;
      log?: DispatcherLogger;
      newId?: () => string;
    },
  ) {}

  async runOnce(now: Date = new Date()): Promise<DispatchReport> {
    const started = Date.now();
    const report: DispatchReport = {
      startedAt: now.toISOString(), durationMs: 0, regionsEvaluated: 0, regionFailures: 0, sent: [], delivered: 0, failed: 0,
      suppressedDedup: 0, suppressedQuietHours: 0, devicesRemoved: 0,
    };
    this.running = true;
    try {
      const { devices, regions } = this.deps;
      const byRegion = new Map<string, Device[]>();
      for (const d of await devices.list()) {
        for (const rid of effectiveRegionIds(d, regions)) byRegion.set(rid, [...(byRegion.get(rid) ?? []), d]);
      }
      const removed = new Set<string>();
      for (const [rid, devs] of byRegion) {
        const region = regions.get(rid);
        if (!region) continue;
        let cond: RegionConditions;
        try {
          cond = await this.deps.conditions(region);
        } catch (err) {
          report.regionFailures++;
          this.deps.log?.warn({ region: rid, err: (err as Error).message }, 'dispatcher: region evaluation failed');
          continue;
        }
        report.regionsEvaluated++;
        await this.dispatchRegion(region, cond, devs.filter((d) => !removed.has(d.id)), now, report, removed);
      }
      this.lastError = null;
      return report;
    } catch (err) {
      this.lastError = (err as Error).message;
      throw err;
    } finally {
      report.durationMs = Date.now() - started;
      this.running = false;
      this.runs++;
      this.lastRunAt = report.startedAt;
      this.lastDurationMs = report.durationMs;
      this.totals.regionsEvaluated += report.regionsEvaluated;
      this.totals.messagesSent += report.sent.length;
      this.totals.delivered += report.delivered;
      this.totals.failed += report.failed;
      this.totals.suppressedDedup += report.suppressedDedup;
      this.totals.suppressedQuietHours += report.suppressedQuietHours;
      this.totals.devicesRemoved += report.devicesRemoved;
    }
  }

  private async dispatchRegion(region: Region, cond: RegionConditions, devs: Device[], now: Date, report: DispatchReport, removed: Set<string>) {
    const local = localTimeAt(now, cond.utcOffsetSeconds);
    const date = dateOf(local);
    const hour = hourOf(local);
    const since = new Date(now.getTime() - DEDUP_WINDOW_MS);

    // Group (dedupKey, locale) → devices, so one message id is shared by everyone receiving it.
    const groups = new Map<string, { cand: Candidate; key: string; locale: t.Locale; devices: Device[] }>();
    for (const device of devs) {
      const cands = candidatesFor(device, region, cond, hour);
      if (!cands.length) continue;
      if (inQuietHours(hour, device.preferences.quietHours)) {
        report.suppressedQuietHours += cands.length;
        continue;
      }
      for (const cand of cands) {
        const key = dedupKey(region.id, cand.kind, cand.subject, date);
        if (await this.deps.history.sentSince(device.id, key, since)) {
          report.suppressedDedup++;
          continue;
        }
        const gk = `${key}|${device.preferences.locale}`;
        const g = groups.get(gk) ?? { cand, key, locale: device.preferences.locale, devices: [] };
        g.devices.push(device);
        groups.set(gk, g);
      }
    }

    for (const g of groups.values()) {
      const { title, body } = g.cand.render(g.locale);
      const message: NotificationMessage = {
        id: (this.deps.newId ?? randomUUID)(),
        kind: g.cand.kind,
        regionId: region.id,
        title,
        body,
        deepLink: g.cand.deepLink,
        dedupKey: g.key,
        sentAt: now.toISOString(),
        data: { kind: g.cand.kind, regionId: region.id, deepLink: g.cand.deepLink, ...g.cand.data },
      };
      if (g.cand.severity) message.severity = g.cand.severity;
      const tickets = await this.deps.push.send(
        g.devices.map((d) => ({ to: d.pushToken, title, body, data: message.data, priority: g.cand.severity === 'warning' ? 'high' : 'default' })),
      );
      const delivered = tickets.filter((x) => x.status === 'ok').length;
      report.delivered += delivered;
      report.failed += tickets.length - delivered;
      report.sent.push(message);
      for (let i = 0; i < g.devices.length; i++) {
        const device = g.devices[i]!;
        const ticket = tickets[i];
        if (ticket?.status === 'error' && ticket.error === 'DeviceNotRegistered') {
          await this.deps.devices.delete(device.id);
          await this.deps.history.deleteForDevice(device.id);
          removed.add(device.id);
          report.devicesRemoved++;
          continue;
        }
        if (ticket?.status === 'ok') await this.deps.history.append(device.id, { ...message, deliveredTo: delivered });
      }
    }
  }

  stats(): DispatcherStats {
    return {
      runs: this.runs,
      running: this.running,
      lastRunAt: this.lastRunAt,
      lastDurationMs: this.lastDurationMs,
      lastError: this.lastError,
      ...this.totals,
    };
  }
}

/** setInterval scheduler; overlapping runs are skipped. Returns a stop function. */
export function scheduleDispatcher(dispatcher: Dispatcher, intervalMs: number, log?: DispatcherLogger): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await dispatcher.runOnce(new Date());
      if (r.sent.length || r.regionFailures) {
        log?.info({ sent: r.sent.length, delivered: r.delivered, failed: r.failed, regions: r.regionsEvaluated, durationMs: r.durationMs }, 'dispatcher run');
      }
    } catch (err) {
      log?.warn({ err: (err as Error).message }, 'dispatcher run failed');
    } finally {
      busy = false;
    }
  };
  const handle = setInterval(() => void tick(), intervalMs);
  handle.unref();
  return () => clearInterval(handle);
}
