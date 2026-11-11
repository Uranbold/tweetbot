import { randomUUID } from 'node:crypto';
import type { Device, DeviceRegistration, NotificationHistoryEntry, NotificationMessage } from '../types.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import type { RegionService } from '../services/regionService.js';
import { dateOf, localTimeAt, tzOffsetSeconds } from '../lib/time.js';
import { CITIES, regionSlug } from '../data/cities.js';
import { dedupKey, effectiveRegionIds } from './dispatcher.js';
import * as t from './i18n.js';
import type { PushSender } from './push.js';
import { DuplicateTokenError, type DevicePatch, type DeviceRepository, type NotificationHistoryRepository } from './repositories.js';

const TZ_BY_REGION = new Map(CITIES.map((c) => [regionSlug(c), c.timezone]));

/** Application service behind the /devices routes. */
export class DeviceService {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly history: NotificationHistoryRepository,
    private readonly push: PushSender,
    private readonly regions: RegionService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private assertRegions(ids: readonly string[] | undefined) {
    const unknown = (ids ?? []).filter((id) => !this.regions.exists(id));
    if (unknown.length) throw new BadRequestError(`unknown regionIds: ${unknown.join(', ')}`);
  }

  async register(reg: DeviceRegistration): Promise<{ device: Device; created: boolean }> {
    this.assertRegions(reg.regionIds);
    return this.devices.upsertByToken(reg, this.clock());
  }

  async get(id: string): Promise<Device> {
    const d = await this.devices.get(id);
    if (!d) throw new NotFoundError(`device ${id} not found`);
    return d;
  }

  async patch(id: string, patch: DevicePatch): Promise<Device> {
    this.assertRegions(patch.regionIds);
    try {
      const d = await this.devices.patch(id, patch, this.clock());
      if (!d) throw new NotFoundError(`device ${id} not found`);
      return d;
    } catch (err) {
      if (err instanceof DuplicateTokenError) throw new BadRequestError(err.message);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    if (!(await this.devices.delete(id))) throw new NotFoundError(`device ${id} not found`);
    await this.history.deleteForDevice(id);
  }

  async notifications(id: string): Promise<NotificationHistoryEntry[]> {
    await this.get(id);
    return this.history.listForDevice(id);
  }

  async sendTest(id: string): Promise<NotificationMessage> {
    const device = await this.get(id);
    const regionId = effectiveRegionIds(device, this.regions)[0] ?? this.regions.list()[0]!.id;
    const region = this.regions.get(regionId)!;
    const now = this.clock();
    const tz = TZ_BY_REGION.get(regionId) ?? 'UTC';
    const date = dateOf(localTimeAt(now, tzOffsetSeconds(tz, now)));
    const locale = device.preferences.locale;
    const deepLink = `skycast://region/${regionId}`;
    const message: NotificationMessage = {
      id: randomUUID(),
      kind: 'test',
      regionId,
      title: t.testTitle(locale),
      body: t.testBody(locale, region.name),
      deepLink,
      dedupKey: dedupKey(regionId, 'test', 'manual', date),
      sentAt: now.toISOString(),
      data: { kind: 'test', regionId, deepLink },
    };
    const [ticket] = await this.push.send([{ to: device.pushToken, title: message.title, body: message.body, data: message.data }]);
    if (ticket?.status === 'error' && ticket.error === 'DeviceNotRegistered') {
      await this.delete(id);
      throw new BadRequestError('push token is no longer registered; device removed');
    }
    await this.history.append(id, { ...message, deliveredTo: ticket?.status === 'ok' ? 1 : 0 });
    return message;
  }
}
