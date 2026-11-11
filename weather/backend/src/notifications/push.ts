import { UpstreamError } from '../errors.js';
import { chunk } from '../lib/concurrency.js';
import type { FetchLike } from '../providers/openmeteo/http.js';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  priority?: 'default' | 'normal' | 'high';
}

export type PushTicket =
  | { status: 'ok'; id?: string }
  | { status: 'error'; message: string; /** e.g. "DeviceNotRegistered", "MessageRateExceeded" */ error?: string };

export interface PushSender {
  readonly name: string;
  /** One ticket per message, same order. Must not throw for per-message failures. */
  send(messages: readonly PushMessage[]): Promise<PushTicket[]>;
}

export interface PushLogger {
  info(obj: object, msg?: string): void;
}

/** Dev/test sender: records and logs instead of delivering. */
export class LogPushSender implements PushSender {
  readonly name = 'log';
  readonly sent: PushMessage[] = [];

  constructor(private readonly log?: PushLogger) {}

  async send(messages: readonly PushMessage[]): Promise<PushTicket[]> {
    for (const m of messages) {
      this.sent.push(m);
      this.log?.info({ to: m.to.slice(0, 24), title: m.title, kind: m.data.kind }, 'push (log mode)');
    }
    return messages.map(() => ({ status: 'ok' as const }));
  }
}

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_CHUNK_SIZE = 100;

interface ExpoTicket {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Expo Push API sender: POSTs in chunks of 100 and maps tickets back to messages. */
export class ExpoPushSender implements PushSender {
  readonly name = 'expo';

  constructor(
    private readonly opts: { timeoutMs: number; accessToken?: string; fetch?: FetchLike; url?: string },
  ) {}

  async send(messages: readonly PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];
    for (const group of chunk(messages, EXPO_CHUNK_SIZE)) tickets.push(...(await this.sendChunk(group)));
    return tickets;
  }

  private async sendChunk(group: PushMessage[]): Promise<PushTicket[]> {
    const doFetch = this.opts.fetch ?? globalThis.fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    if (this.opts.accessToken) headers.authorization = `Bearer ${this.opts.accessToken}`;
    try {
      const res = await doFetch(this.opts.url ?? EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(group.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: 'default', priority: m.priority ?? 'default' }))),
        signal: controller.signal,
      });
      if (!res.ok) {
        const kind = res.status === 429 ? 'rate-limited' : res.status >= 500 ? 'server' : 'client';
        throw new UpstreamError('expo-push', kind, `HTTP ${res.status}`, res.status);
      }
      const json = (await res.json()) as { data?: ExpoTicket[] | ExpoTicket };
      const data = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
      return group.map((_, i): PushTicket => {
        const t = data[i];
        if (!t) return { status: 'error', message: 'missing ticket' };
        if (t.status === 'ok') return t.id ? { status: 'ok', id: t.id } : { status: 'ok' };
        const ticket: PushTicket = { status: 'error', message: t.message ?? 'push failed' };
        if (t.details?.error) ticket.error = t.details.error;
        return ticket;
      });
    } catch (err) {
      // A failed chunk fails each of its messages; the dispatcher keeps going with other chunks.
      const message = controller.signal.aborted ? `timed out after ${this.opts.timeoutMs} ms` : (err as Error).message;
      return group.map(() => ({ status: 'error' as const, message }));
    } finally {
      clearTimeout(timer);
    }
  }
}
