import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ApiResponse, Device, NotificationHistoryEntry, NotificationMessage } from '../../src/types.js';
import { LogPushSender } from '../../src/notifications/push.js';
import { makeApp } from '../helpers/app.js';

let app: FastifyInstance;
afterEach(async () => app?.close());

const reg = (o: Record<string, unknown> = {}) => ({ pushToken: 'ExponentPushToken[abc]', platform: 'ios', regionIds: ['mn-ulaanbaatar'], ...o });
const post = (body: unknown) => app.inject({ method: 'POST', url: '/api/v1/devices', payload: body as object });

describe('POST /devices', () => {
  it('creates a device with preference defaults (201)', async () => {
    ({ app } = await makeApp());
    const r = await post(reg());
    expect(r.statusCode).toBe(201);
    const d = r.json<ApiResponse<Device>>().data;
    expect(d.id).toMatch(/[0-9a-f-]{36}/);
    expect(d.followLocation).toBe(false);
    expect(d.preferences).toEqual({
      alertTypes: ['heat-wave', 'cold-wave', 'heavy-rain', 'heavy-snow', 'strong-wind', 'dry', 'fine-dust', 'typhoon'],
      minSeverity: 'advisory', aiRiskThreshold: 0.6, dailyBriefingHour: null, airGradeThreshold: 'bad', quietHours: null, locale: 'en',
    });
    expect(d.createdAt).toBe(d.updatedAt);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('is idempotent by pushToken: same id, updated fields (200)', async () => {
    ({ app } = await makeApp());
    const first = (await post(reg())).json<ApiResponse<Device>>().data;
    const r = await post(reg({ regionIds: ['kr-seoul'], preferences: { locale: 'ko' } }));
    expect(r.statusCode).toBe(200);
    const second = r.json<ApiResponse<Device>>().data;
    expect(second.id).toBe(first.id);
    expect(second.regionIds).toEqual(['kr-seoul']);
    expect(second.preferences.locale).toBe('ko');
    expect(second.createdAt).toBe(first.createdAt);
    const other = (await post(reg({ pushToken: 'ExponentPushToken[other]' }))).json<ApiResponse<Device>>().data;
    expect(other.id).not.toBe(first.id);
  });

  it.each([
    [{ ...reg(), pushToken: '' }, /pushToken/],
    [{ ...reg(), pushToken: '   ' }, /pushToken/],
    [{ ...reg(), platform: 'symbian' }, /platform/],
    [{ ...reg(), regionIds: ['xx-nowhere'] }, /unknown regionIds: xx-nowhere/],
    [{ ...reg(), regionIds: [] }, /regionIds must not be empty/],
    [{ ...reg(), preferences: { minSeverity: 'catastrophic' } }, /minSeverity/],
    [{ ...reg(), preferences: { aiRiskThreshold: 1.5 } }, /aiRiskThreshold/],
    [{ ...reg(), preferences: { quietHours: { start: 25, end: 7 } } }, /quietHours/],
    [{ ...reg(), preferences: { locale: 'fr' } }, /locale/],
    [{ ...reg(), preferences: { alertTypes: ['meteor'] } }, /alertTypes/],
    [{ ...reg(), lastLocation: { lat: 100, lon: 0 } }, /lastLocation/],
  ])('rejects invalid body %#', async (body, msg) => {
    ({ app } = await makeApp());
    const r = await post(body);
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe('BAD_REQUEST');
    expect(r.json().error.message).toMatch(msg);
  });

  it('allows empty regionIds when following location', async () => {
    ({ app } = await makeApp());
    const r = await post(reg({ regionIds: [], followLocation: true, lastLocation: { lat: 37.5, lon: 127 } }));
    expect(r.statusCode).toBe(201);
  });

  it('rejects malformed JSON and missing bodies with 400', async () => {
    ({ app } = await makeApp());
    const bad = await app.inject({ method: 'POST', url: '/api/v1/devices', payload: '{oops', headers: { 'content-type': 'application/json' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('BAD_REQUEST');
    const empty = await app.inject({ method: 'POST', url: '/api/v1/devices' });
    expect(empty.statusCode).toBe(400);
  });
});

describe('GET / PATCH / DELETE /devices/:id', () => {
  it('reads, merges preferences on PATCH, and deletes', async () => {
    ({ app } = await makeApp());
    const d = (await post(reg({ preferences: { locale: 'mn', quietHours: { start: 22, end: 7 } } }))).json<ApiResponse<Device>>().data;
    expect((await app.inject(`/api/v1/devices/${d.id}`)).json<ApiResponse<Device>>().data.id).toBe(d.id);

    const p = await app.inject({ method: 'PATCH', url: `/api/v1/devices/${d.id}`, payload: { preferences: { minSeverity: 'warning' }, regionIds: ['mn-ulaanbaatar', 'kr-seoul'] } });
    expect(p.statusCode).toBe(200);
    const patched = p.json<ApiResponse<Device>>().data;
    expect(patched.preferences).toMatchObject({ minSeverity: 'warning', locale: 'mn', quietHours: { start: 22, end: 7 }, aiRiskThreshold: 0.6 });
    expect(patched.regionIds).toEqual(['mn-ulaanbaatar', 'kr-seoul']);
    expect(patched.pushToken).toBe(d.pushToken);

    expect((await app.inject({ method: 'PATCH', url: `/api/v1/devices/${d.id}`, payload: { regionIds: ['nope'] } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/devices/${d.id}`, payload: { preferences: { locale: 'xx' } } })).statusCode).toBe(400);

    const del = await app.inject({ method: 'DELETE', url: `/api/v1/devices/${d.id}` });
    expect(del.statusCode).toBe(204);
    expect(del.body).toBe('');
    expect((await app.inject(`/api/v1/devices/${d.id}`)).statusCode).toBe(404);
  });

  it('rejects moving a pushToken onto another device', async () => {
    ({ app } = await makeApp());
    await post(reg({ pushToken: 't1' }));
    const b = (await post(reg({ pushToken: 't2' }))).json<ApiResponse<Device>>().data;
    const r = await app.inject({ method: 'PATCH', url: `/api/v1/devices/${b.id}`, payload: { pushToken: 't1' } });
    expect(r.statusCode).toBe(400);
  });

  it.each([
    ['GET', '/api/v1/devices/missing'],
    ['PATCH', '/api/v1/devices/missing'],
    ['DELETE', '/api/v1/devices/missing'],
    ['GET', '/api/v1/devices/missing/notifications'],
    ['POST', '/api/v1/devices/missing/test-notification'],
  ] as const)('%s %s → 404', async (method, url) => {
    ({ app } = await makeApp());
    const r = await app.inject({ method, url, ...(method === 'PATCH' ? { payload: {} } : {}) });
    expect(r.statusCode).toBe(404);
    expect(r.json().error.code).toBe('NOT_FOUND');
  });
});

describe('test notification + history', () => {
  it('sends via the push sender, returns the message and records it', async () => {
    const push = new LogPushSender();
    ({ app } = await makeApp({}, { push }));
    const d = (await post(reg({ preferences: { locale: 'ko' } }))).json<ApiResponse<Device>>().data;
    // JSON content-type with an empty body is accepted (common client behaviour).
    const r = await app.inject({ method: 'POST', url: `/api/v1/devices/${d.id}/test-notification`, headers: { 'content-type': 'application/json' } });
    expect(r.statusCode).toBe(200);
    const msg = r.json<ApiResponse<NotificationMessage>>().data;
    expect(msg).toMatchObject({ kind: 'test', regionId: 'mn-ulaanbaatar', title: 'Skycast 테스트 알림', deepLink: 'skycast://region/mn-ulaanbaatar' });
    expect(msg.dedupKey).toMatch(/^mn-ulaanbaatar:test:manual:\d{4}-\d{2}-\d{2}$/);
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]!.to).toBe('ExponentPushToken[abc]');

    const h = (await app.inject(`/api/v1/devices/${d.id}/notifications`)).json<ApiResponse<NotificationHistoryEntry[]>>().data;
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ id: msg.id, deliveredTo: 1 });
  });
});
