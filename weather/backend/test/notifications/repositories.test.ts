import { describe, expect, it } from 'vitest';
import {
  DuplicateTokenError, HISTORY_LIMIT, InMemoryDeviceRepository, InMemoryNotificationHistoryRepository,
} from '../../src/notifications/repositories.js';
import type { DeviceRegistration, NotificationHistoryEntry } from '../../src/types.js';

const prefs: DeviceRegistration['preferences'] = {
  alertTypes: ['cold-wave'], minSeverity: 'advisory', aiRiskThreshold: 0.6, dailyBriefingHour: null, airGradeThreshold: 'bad', quietHours: null, locale: 'en',
};
const reg = (o: Partial<DeviceRegistration> = {}): DeviceRegistration => ({ pushToken: 'tok', platform: 'android', regionIds: ['mn-ulaanbaatar'], followLocation: false, preferences: prefs, ...o });
const t0 = new Date('2026-10-01T00:00:00Z');
const t1 = new Date('2026-10-01T01:00:00Z');

describe('InMemoryDeviceRepository', () => {
  it('upserts by push token', async () => {
    let n = 0;
    const repo = new InMemoryDeviceRepository(() => `id-${++n}`);
    const a = await repo.upsertByToken(reg(), t0);
    expect(a).toMatchObject({ created: true, device: { id: 'id-1', createdAt: t0.toISOString() } });
    const b = await repo.upsertByToken(reg({ regionIds: ['kr-seoul'] }), t1);
    expect(b).toMatchObject({ created: false, device: { id: 'id-1', createdAt: t0.toISOString(), updatedAt: t1.toISOString(), regionIds: ['kr-seoul'] } });
    expect(await repo.count()).toBe(1);
    expect((await repo.getByToken('tok'))?.id).toBe('id-1');
  });

  it('patches with a preference merge and keeps the token index consistent', async () => {
    const repo = new InMemoryDeviceRepository();
    const { device } = await repo.upsertByToken(reg(), t0);
    const p = await repo.patch(device.id, { pushToken: 'tok2', preferences: { locale: 'mn' } }, t1);
    expect(p?.preferences).toEqual({ ...prefs, locale: 'mn' });
    expect(await repo.getByToken('tok')).toBeUndefined();
    expect((await repo.getByToken('tok2'))?.id).toBe(device.id);
    expect(await repo.patch('missing', {}, t1)).toBeUndefined();
    await repo.upsertByToken(reg({ pushToken: 'tok3' }), t0);
    await expect(repo.patch(device.id, { pushToken: 'tok3' }, t1)).rejects.toBeInstanceOf(DuplicateTokenError);
  });

  it('lists by region, returns copies, and deletes', async () => {
    const repo = new InMemoryDeviceRepository();
    const { device } = await repo.upsertByToken(reg(), t0);
    await repo.upsertByToken(reg({ pushToken: 'x', regionIds: ['kr-seoul'] }), t0);
    expect((await repo.listByRegion('mn-ulaanbaatar')).map((d) => d.id)).toEqual([device.id]);
    const copy = (await repo.get(device.id))!;
    copy.regionIds.push('mutated');
    expect((await repo.get(device.id))!.regionIds).toEqual(['mn-ulaanbaatar']);
    expect(await repo.delete(device.id)).toBe(true);
    expect(await repo.delete(device.id)).toBe(false);
    expect(await repo.getByToken('tok')).toBeUndefined();
    expect(await repo.list()).toHaveLength(1);
  });
});

describe('InMemoryNotificationHistoryRepository', () => {
  const entry = (i: number, sentAt: string, dedupKey = `k${i}`): NotificationHistoryEntry => ({
    id: `m${i}`, kind: 'alert', regionId: 'mn-ulaanbaatar', title: 't', body: 'b', deepLink: 'skycast://x', dedupKey, sentAt, data: {}, deliveredTo: 1,
  });

  it('keeps the newest 50 per device', async () => {
    const repo = new InMemoryNotificationHistoryRepository();
    for (let i = 0; i < 60; i++) await repo.append('d1', entry(i, new Date(t0.getTime() + i * 1000).toISOString()));
    const list = await repo.listForDevice('d1');
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0]!.id).toBe('m59');
    expect(await repo.listForDevice('d2')).toEqual([]);
  });

  it('looks up dedup keys within a 24 h window, independent of the 50-entry cap', async () => {
    const repo = new InMemoryNotificationHistoryRepository();
    await repo.append('d1', entry(0, t0.toISOString(), 'mn-ulaanbaatar:alert:cold-wave:2026-10-01'));
    for (let i = 1; i < 60; i++) await repo.append('d1', entry(i, t1.toISOString()));
    const since = (h: number) => new Date(t0.getTime() + h * 3_600_000 - 24 * 3_600_000);
    expect(await repo.sentSince('d1', 'mn-ulaanbaatar:alert:cold-wave:2026-10-01', since(23))).toBe(true);
    expect(await repo.sentSince('d1', 'mn-ulaanbaatar:alert:cold-wave:2026-10-01', since(25))).toBe(false);
    expect(await repo.sentSince('d2', 'mn-ulaanbaatar:alert:cold-wave:2026-10-01', since(1))).toBe(false);
    await repo.deleteForDevice('d1');
    expect(await repo.sentSince('d1', 'mn-ulaanbaatar:alert:cold-wave:2026-10-01', since(1))).toBe(false);
  });
});
