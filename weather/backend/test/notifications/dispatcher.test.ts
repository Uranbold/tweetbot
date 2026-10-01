import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AirQualitySnapshot, DeviceRegistration, HazardRisk, NotificationPreferences, Region, WeatherAlert } from '../../src/types.js';
import { Dispatcher, dedupKey, effectiveRegionIds, inQuietHours, scheduleDispatcher } from '../../src/notifications/dispatcher.js';
import { LogPushSender, type PushSender } from '../../src/notifications/push.js';
import { InMemoryDeviceRepository, InMemoryNotificationHistoryRepository } from '../../src/notifications/repositories.js';
import type { RegionConditions } from '../../src/services/regionAlertsService.js';
import { RegionService } from '../../src/services/regionService.js';
import { makeApp } from '../helpers/app.js';

// 14:30Z = 22:30 in Ulaanbaatar (UTC+8)
const NOW = new Date('2026-10-01T02:30:00Z'); // 10:30 local
const UB_OFFSET = 28800;

const coldWave: WeatherAlert = { type: 'cold-wave', severity: 'advisory', title: 'Cold wave advisory', description: 'Morning minimum of −13°C (≤ −12°C)', start: '2026-10-02T00:00', end: '2026-10-03T00:00', source: 'derived' };
const windWarning: WeatherAlert = { ...coldWave, type: 'strong-wind', severity: 'warning', title: 'Strong wind warning', description: 'Wind up to 22 m/s' };
const badAir: AirQualitySnapshot = { time: '2026-10-01T10:00', pm10: 90, pm25: 50, o3: 20, no2: 30, so2: 10, co: 500, pm10Grade: 'bad', pm25Grade: 'bad', overallGrade: 'bad' };

function conditions(o: Partial<RegionConditions> = {}): RegionConditions {
  return {
    alerts: [], risks: [], air: null, utcOffsetSeconds: UB_OFFSET, headline: 'Clear skies, staying dry', temperatureMax: 9.4, temperatureMin: -2.6,
    meta: { provider: 'mock', fetchedAt: NOW.toISOString(), stale: false, mock: true }, cache: 'MISS', maxAge: 600, ...o,
  };
}

const prefs = (o: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  alertTypes: ['heat-wave', 'cold-wave', 'heavy-rain', 'heavy-snow', 'strong-wind', 'dry', 'fine-dust', 'typhoon'],
  minSeverity: 'advisory', aiRiskThreshold: 0.6, dailyBriefingHour: null, airGradeThreshold: null, quietHours: null, locale: 'en', ...o,
});

function setup(cond: (r: Region) => RegionConditions | Promise<RegionConditions> = () => conditions(), push: PushSender = new LogPushSender()) {
  const devices = new InMemoryDeviceRepository();
  const history = new InMemoryNotificationHistoryRepository();
  const regions = new RegionService();
  const calls: string[] = [];
  const dispatcher = new Dispatcher({
    devices, history, push, regions,
    conditions: async (r) => {
      calls.push(r.id);
      return cond(r);
    },
  });
  const add = (o: Partial<DeviceRegistration> = {}, p: Partial<NotificationPreferences> = {}) =>
    devices.upsertByToken({ pushToken: `tok-${Math.random()}`, platform: 'ios', regionIds: ['mn-ulaanbaatar'], followLocation: false, preferences: prefs(p), ...o }, NOW).then((r) => r.device);
  return { devices, history, regions, dispatcher, add, calls, push };
}

describe('dispatcher', () => {
  it('creates a message when an alert threshold is crossed', async () => {
    const s = setup(() => conditions({ alerts: [coldWave] }));
    const d = await s.add();
    const r = await s.dispatcher.runOnce(NOW);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toMatchObject({
      kind: 'alert', regionId: 'mn-ulaanbaatar', severity: 'advisory', title: 'Cold wave advisory · Ulaanbaatar',
      dedupKey: 'mn-ulaanbaatar:alert:cold-wave:2026-10-01', deepLink: 'skycast://region/mn-ulaanbaatar/alerts',
    });
    expect(r.sent[0]!.data).toMatchObject({ kind: 'alert', hazard: 'cold-wave', severity: 'advisory', regionId: 'mn-ulaanbaatar' });
    expect(r.delivered).toBe(1);
    const h = await s.history.listForDevice(d.id);
    expect(h).toHaveLength(1);
    expect(h[0]!.deliveredTo).toBe(1);
  });

  it('dedup suppresses the second run within 24 h, and a new day sends again', async () => {
    const s = setup(() => conditions({ alerts: [coldWave] }));
    await s.add();
    expect((await s.dispatcher.runOnce(NOW)).sent).toHaveLength(1);
    const second = await s.dispatcher.runOnce(new Date(NOW.getTime() + 10 * 60_000));
    expect(second.sent).toHaveLength(0);
    expect(second.suppressedDedup).toBe(1);
    const nextDay = await s.dispatcher.runOnce(new Date(NOW.getTime() + 24 * 3_600_000));
    expect(nextDay.sent.map((m) => m.dedupKey)).toEqual(['mn-ulaanbaatar:alert:cold-wave:2026-10-02']);
  });

  it('quiet hours (region local time) suppress delivery without consuming the dedup key', async () => {
    const s = setup(() => conditions({ alerts: [coldWave] }));
    await s.add({}, { quietHours: { start: 22, end: 7 } });
    const night = new Date('2026-10-01T15:00:00Z'); // 23:00 in Ulaanbaatar
    const r = await s.dispatcher.runOnce(night);
    expect(r.sent).toHaveLength(0);
    expect(r.suppressedQuietHours).toBe(1);
    const morning = new Date('2026-10-01T23:30:00Z'); // 07:30 next day local
    expect((await s.dispatcher.runOnce(morning)).sent).toHaveLength(1);
  });

  it('inQuietHours handles wrap-around and same-day windows', () => {
    expect([21, 22, 23, 0, 6, 7].map((h) => inQuietHours(h, { start: 22, end: 7 }))).toEqual([false, true, true, true, true, false]);
    expect([12, 13, 14].map((h) => inQuietHours(h, { start: 13, end: 14 }))).toEqual([false, true, false]);
    expect(inQuietHours(3, null)).toBe(false);
    expect(inQuietHours(3, { start: 5, end: 5 })).toBe(false);
  });

  it('applies minSeverity and alertTypes filters', async () => {
    const s = setup(() => conditions({ alerts: [coldWave, windWarning] }));
    await s.add({}, { minSeverity: 'warning' });
    await s.add({}, { alertTypes: ['cold-wave'] });
    const r = await s.dispatcher.runOnce(NOW);
    expect(r.sent.map((m) => `${m.kind}:${m.data.hazard}:${m.severity}`).sort()).toEqual(['alert:cold-wave:advisory', 'alert:strong-wind:warning']);
    expect(r.delivered).toBe(2);
  });

  it('notifies AI risks at or above the device threshold (0 disables)', async () => {
    const risk: HazardRisk = { hazard: 'heavy-snow', severity: 'advisory', probability: 0.7, rationale: '5/7 models ≥ 5 cm' };
    const s = setup(() => conditions({ risks: [risk] }));
    const yes = await s.add({}, { aiRiskThreshold: 0.6 });
    await s.add({}, { aiRiskThreshold: 0.8 });
    await s.add({}, { aiRiskThreshold: 0 });
    const r = await s.dispatcher.runOnce(NOW);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toMatchObject({ kind: 'ai-risk', title: 'Heavy snow likely (70%) · Ulaanbaatar', dedupKey: 'mn-ulaanbaatar:ai-risk:heavy-snow:2026-10-01' });
    expect(await s.history.listForDevice(yes.id)).toHaveLength(1);
  });

  it('notifies when the air grade reaches the threshold', async () => {
    const s = setup(() => conditions({ air: badAir }));
    await s.add({}, { airGradeThreshold: 'bad' });
    await s.add({}, { airGradeThreshold: 'very-bad' });
    await s.add({}, { airGradeThreshold: null });
    const r = await s.dispatcher.runOnce(NOW);
    expect(r.sent).toHaveLength(1);
    expect(r.sent[0]).toMatchObject({ kind: 'air-quality', dedupKey: 'mn-ulaanbaatar:air-quality:bad:2026-10-01', deepLink: 'skycast://region/mn-ulaanbaatar/air' });
  });

  it('sends the daily briefing only at the configured local hour, localised', async () => {
    const s = setup();
    await s.add({}, { dailyBriefingHour: 10, locale: 'mn' });
    await s.add({}, { dailyBriefingHour: 10, locale: 'ko' });
    await s.add({}, { dailyBriefingHour: 7 });
    const r = await s.dispatcher.runOnce(NOW); // 10:30 local
    expect(r.sent.map((m) => m.title).sort()).toEqual(['Өнөөдрийн цаг агаар · Ulaanbaatar', '오늘의 날씨 · Ulaanbaatar']);
    expect(r.sent[0]!.dedupKey).toBe('mn-ulaanbaatar:daily-briefing:day:2026-10-01');
  });

  it('shares one message between devices with the same locale', async () => {
    const s = setup(() => conditions({ alerts: [coldWave] }));
    const a = await s.add();
    const b = await s.add();
    const r = await s.dispatcher.runOnce(NOW);
    expect(r.sent).toHaveLength(1);
    expect((await s.history.listForDevice(a.id))[0]).toMatchObject({ id: r.sent[0]!.id, deliveredTo: 2 });
    expect((await s.history.listForDevice(b.id))[0]!.id).toBe(r.sent[0]!.id);
  });

  it('follows location: picks the nearest region by haversine', async () => {
    const s = setup((r) => conditions({ alerts: r.id === 'kr-busan' ? [coldWave] : [], utcOffsetSeconds: 32400 }));
    const d = await s.add({ regionIds: [], followLocation: true, lastLocation: { lat: 35.15, lon: 129.06 } });
    expect(effectiveRegionIds(d, s.regions)).toEqual(['kr-busan']);
    const r = await s.dispatcher.runOnce(NOW);
    expect(s.calls).toEqual(['kr-busan']);
    expect(r.sent[0]!.regionId).toBe('kr-busan');
    // Without followLocation the last location is ignored.
    const e = await s.add({ regionIds: ['kr-seoul'], followLocation: false, lastLocation: { lat: 35.15, lon: 129.06 } });
    expect(effectiveRegionIds(e, s.regions)).toEqual(['kr-seoul']);
  });

  it('evaluates only regions that have devices, and survives a failing region', async () => {
    const s = setup((r) => {
      if (r.id === 'kr-seoul') throw new Error('upstream down');
      return conditions({ alerts: [coldWave] });
    });
    await s.add({ regionIds: ['kr-seoul', 'mn-ulaanbaatar'] });
    const r = await s.dispatcher.runOnce(NOW);
    expect(s.calls.sort()).toEqual(['kr-seoul', 'mn-ulaanbaatar']);
    expect(r.regionFailures).toBe(1);
    expect(r.sent).toHaveLength(1);
    const st = s.dispatcher.stats();
    expect(st).toMatchObject({ runs: 1, messagesSent: 1, delivered: 1, running: false, lastError: null });
  });

  it('removes devices whose token is DeviceNotRegistered', async () => {
    const push: PushSender = { name: 'fake', send: async (ms) => ms.map(() => ({ status: 'error' as const, message: 'gone', error: 'DeviceNotRegistered' })) };
    const s = setup(() => conditions({ alerts: [coldWave] }), push);
    const d = await s.add();
    const r = await s.dispatcher.runOnce(NOW);
    expect(r.devicesRemoved).toBe(1);
    expect(r.failed).toBe(1);
    expect(await s.devices.get(d.id)).toBeUndefined();
  });

  it('builds dedup keys in the documented format', () => {
    expect(dedupKey('mn-ulaanbaatar', 'alert', 'cold-wave', '2026-10-01')).toBe('mn-ulaanbaatar:alert:cold-wave:2026-10-01');
  });
});

describe('scheduling', () => {
  afterEach(() => vi.useRealTimers());

  it('runs on an interval and can be stopped', async () => {
    vi.useFakeTimers();
    const runOnce = vi.fn(async () => ({ sent: [], regionFailures: 0 }) as never);
    const stop = scheduleDispatcher({ runOnce } as unknown as Dispatcher, 1000);
    await vi.advanceTimersByTimeAsync(3500);
    expect(runOnce).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(runOnce).toHaveBeenCalledTimes(3);
  });

  it('exposes dispatcher stats in /health after a run through the real wiring', async () => {
    const { app, container } = await makeApp();
    await app.inject({ method: 'POST', url: '/api/v1/devices', payload: { pushToken: 't', platform: 'web', regionIds: ['mn-ulaanbaatar'] } });
    await container.notifications.dispatcher.runOnce(new Date());
    const h = (await app.inject('/api/v1/health')).json();
    expect(h.notifications).toMatchObject({ push: 'log', devices: 1, dispatcher: { runs: 1, regionsEvaluated: 1 } });
    await app.close();
  });
});
