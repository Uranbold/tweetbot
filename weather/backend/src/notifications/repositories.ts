/**
 * Persistence ports for notifications + in-memory adapters. The interfaces are async and
 * id/token keyed so Redis (hashes + sets) or Postgres (devices / notification_history
 * tables with a unique index on push_token) can implement them without changes upstream.
 */
import { randomUUID } from 'node:crypto';
import type { Device, DeviceRegistration, NotificationHistoryEntry, NotificationPreferences } from '../types.js';

export type DevicePatch = Partial<Omit<DeviceRegistration, 'preferences'>> & { preferences?: Partial<NotificationPreferences> };

export interface DeviceRepository {
  /** Insert, or update the device that already owns `reg.pushToken`. */
  upsertByToken(reg: DeviceRegistration, now: Date): Promise<{ device: Device; created: boolean }>;
  get(id: string): Promise<Device | undefined>;
  getByToken(pushToken: string): Promise<Device | undefined>;
  /** Shallow merge, with `preferences` merged field by field. */
  patch(id: string, patch: DevicePatch, now: Date): Promise<Device | undefined>;
  delete(id: string): Promise<boolean>;
  listByRegion(regionId: string): Promise<Device[]>;
  list(): Promise<Device[]>;
  count(): Promise<number>;
}

export class DuplicateTokenError extends Error {
  constructor() {
    super('pushToken is already registered to another device');
  }
}

const clone = <T>(v: T): T => structuredClone(v);

export class InMemoryDeviceRepository implements DeviceRepository {
  private readonly byId = new Map<string, Device>();
  private readonly idByToken = new Map<string, string>();

  constructor(private readonly newId: () => string = randomUUID) {}

  async upsertByToken(reg: DeviceRegistration, now: Date): Promise<{ device: Device; created: boolean }> {
    const existingId = this.idByToken.get(reg.pushToken);
    const ts = now.toISOString();
    if (existingId) {
      const prev = this.byId.get(existingId)!;
      const device: Device = { ...clone(reg), id: prev.id, createdAt: prev.createdAt, updatedAt: ts };
      this.byId.set(device.id, device);
      return { device: clone(device), created: false };
    }
    const device: Device = { ...clone(reg), id: this.newId(), createdAt: ts, updatedAt: ts };
    this.byId.set(device.id, device);
    this.idByToken.set(device.pushToken, device.id);
    return { device: clone(device), created: true };
  }

  async get(id: string): Promise<Device | undefined> {
    const d = this.byId.get(id);
    return d && clone(d);
  }

  async getByToken(pushToken: string): Promise<Device | undefined> {
    const id = this.idByToken.get(pushToken);
    return id ? this.get(id) : undefined;
  }

  async patch(id: string, patch: DevicePatch, now: Date): Promise<Device | undefined> {
    const prev = this.byId.get(id);
    if (!prev) return undefined;
    if (patch.pushToken && patch.pushToken !== prev.pushToken) {
      const owner = this.idByToken.get(patch.pushToken);
      if (owner && owner !== id) throw new DuplicateTokenError();
    }
    const { preferences, ...rest } = clone(patch);
    const next: Device = {
      ...prev,
      ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)),
      preferences: { ...prev.preferences, ...(preferences ?? {}) },
      id: prev.id,
      createdAt: prev.createdAt,
      updatedAt: now.toISOString(),
    };
    if (next.pushToken !== prev.pushToken) {
      this.idByToken.delete(prev.pushToken);
      this.idByToken.set(next.pushToken, id);
    }
    this.byId.set(id, next);
    return clone(next);
  }

  async delete(id: string): Promise<boolean> {
    const d = this.byId.get(id);
    if (!d) return false;
    this.byId.delete(id);
    this.idByToken.delete(d.pushToken);
    return true;
  }

  async listByRegion(regionId: string): Promise<Device[]> {
    return [...this.byId.values()].filter((d) => d.regionIds.includes(regionId)).map(clone);
  }

  async list(): Promise<Device[]> {
    return [...this.byId.values()].map(clone);
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}

export interface NotificationHistoryRepository {
  append(deviceId: string, entry: NotificationHistoryEntry): Promise<void>;
  /** Newest first, at most `limit` (default 50). */
  listForDevice(deviceId: string, limit?: number): Promise<NotificationHistoryEntry[]>;
  /** True when `dedupKey` was sent to this device at or after `since`. */
  sentSince(deviceId: string, dedupKey: string, since: Date): Promise<boolean>;
  deleteForDevice(deviceId: string): Promise<void>;
}

export const HISTORY_LIMIT = 50;
const DEDUP_WINDOW_MS = 24 * 3_600_000;

export class InMemoryNotificationHistoryRepository implements NotificationHistoryRepository {
  private readonly entries = new Map<string, NotificationHistoryEntry[]>();
  /** deviceId → dedupKey → last sent epoch ms. Kept separately so the 50-entry cap never weakens dedup. */
  private readonly dedup = new Map<string, Map<string, number>>();

  async append(deviceId: string, entry: NotificationHistoryEntry): Promise<void> {
    const list = this.entries.get(deviceId) ?? [];
    list.unshift(clone(entry));
    if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
    this.entries.set(deviceId, list);
    const keys = this.dedup.get(deviceId) ?? new Map<string, number>();
    const sentAt = Date.parse(entry.sentAt);
    keys.set(entry.dedupKey, sentAt);
    for (const [k, t] of keys) if (sentAt - t > DEDUP_WINDOW_MS) keys.delete(k); // prune
    this.dedup.set(deviceId, keys);
  }

  async listForDevice(deviceId: string, limit = HISTORY_LIMIT): Promise<NotificationHistoryEntry[]> {
    return (this.entries.get(deviceId) ?? []).slice(0, limit).map(clone);
  }

  async sentSince(deviceId: string, dedupKey: string, since: Date): Promise<boolean> {
    const t = this.dedup.get(deviceId)?.get(dedupKey);
    return t !== undefined && t >= since.getTime();
  }

  async deleteForDevice(deviceId: string): Promise<void> {
    this.entries.delete(deviceId);
    this.dedup.delete(deviceId);
  }
}
