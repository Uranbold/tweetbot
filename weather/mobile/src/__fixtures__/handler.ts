/**
 * Fixture-backed transport used by tests and by `EXPO_PUBLIC_USE_FIXTURES=1` so the app runs with no backend.
 * Mirrors the backend's routing just enough for every endpoint the mobile client calls.
 */
import type { ApiError, ApiResponse, Device, DeviceRegistration } from '@contract';
import { predictFixture } from './predict';
import {
  deviceFixture,
  emptyRegionAlerts,
  notificationHistoryFixture,
  regionAlertsFixture,
  regionsFixture,
  testNotificationFixture,
} from './regions';
import { fixtureMeta, weatherFixture } from './weather';

export interface FixtureResponse {
  status: number;
  body: ApiResponse<unknown> | ApiError | null;
}

const ok = <T>(data: T): FixtureResponse => ({ status: 200, body: { data, meta: fixtureMeta } });
const notFound = (message: string): FixtureResponse => ({
  status: 404,
  body: { error: { code: 'NOT_FOUND', message } },
});

/** In-memory device table so register → patch → read round-trips during a session. */
const devices = new Map<string, Device>();

export function resetFixtureState(): void {
  devices.clear();
}

export function handleFixtureRequest(method: string, path: string, body?: unknown): FixtureResponse {
  const [pathname] = path.split('?');
  const segments = (pathname ?? '').split('/').filter(Boolean);
  const m = method.toUpperCase();

  if (segments[0] === 'weather' && m === 'GET') return ok(weatherFixture);
  if (segments[0] === 'predict' && m === 'GET') return ok(predictFixture);
  if (segments[0] === 'regions') {
    if (segments.length === 1 && m === 'GET') return ok(regionsFixture);
    const id = segments[1] ?? '';
    if (segments[2] === 'alerts' && m === 'GET') {
      if (!regionsFixture.some((r) => r.id === id)) return notFound(`Unknown region ${id}`);
      return ok(regionAlertsFixture[id] ?? emptyRegionAlerts);
    }
  }
  if (segments[0] === 'devices') {
    if (segments.length === 1 && m === 'POST') {
      const reg = body as DeviceRegistration;
      const existing = [...devices.values()].find((d) => d.pushToken === reg.pushToken);
      const now = new Date().toISOString();
      const device: Device = {
        ...(existing ?? deviceFixture),
        ...reg,
        id: existing?.id ?? `dev_fixture_${devices.size + 1}`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      devices.set(device.id, device);
      return ok(device);
    }
    const id = segments[1] ?? '';
    if (segments.length === 2) {
      const existing = devices.get(id) ?? (id === deviceFixture.id ? deviceFixture : undefined);
      if (!existing) return notFound(`Unknown device ${id}`);
      if (m === 'GET') return ok(existing);
      if (m === 'PATCH') {
        const patched: Device = {
          ...existing,
          ...(body as Partial<DeviceRegistration>),
          updatedAt: new Date().toISOString(),
        };
        devices.set(id, patched);
        return ok(patched);
      }
      if (m === 'DELETE') {
        devices.delete(id);
        return { status: 204, body: null };
      }
    }
    if (segments[2] === 'notifications' && m === 'GET') return ok(notificationHistoryFixture);
    if (segments[2] === 'test-notification' && m === 'POST') {
      return ok({ ...testNotificationFixture, sentAt: new Date().toISOString() });
    }
  }
  return notFound(`No fixture for ${m} ${path}`);
}
