import { describe, expect, it } from 'vitest';
import { EXPO_PUSH_URL, ExpoPushSender, type PushMessage } from '../../src/notifications/push.js';

const msgs = (n: number): PushMessage[] => Array.from({ length: n }, (_, i) => ({ to: `ExponentPushToken[${i}]`, title: 't', body: 'b', data: { kind: 'alert' } }));

describe('ExpoPushSender', () => {
  it('posts in chunks of 100 and maps tickets back in order', async () => {
    const bodies: unknown[][] = [];
    const fetch = async (url: string, init?: RequestInit) => {
      expect(url).toBe(EXPO_PUSH_URL);
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init!.body)) as { to: string }[];
      bodies.push(body);
      const data = body.map((m) =>
        m.to === 'ExponentPushToken[150]'
          ? { status: 'error', message: '"ExponentPushToken[150]" is not a registered push notification recipient', details: { error: 'DeviceNotRegistered' } }
          : { status: 'ok', id: `ticket-${m.to}` },
      );
      return new Response(JSON.stringify({ data }), { status: 200 });
    };
    const sender = new ExpoPushSender({ timeoutMs: 1000, fetch, accessToken: 'secret' });
    const tickets = await sender.send(msgs(250));
    expect(bodies.map((b) => b.length)).toEqual([100, 100, 50]);
    expect(tickets).toHaveLength(250);
    expect(tickets[0]).toEqual({ status: 'ok', id: 'ticket-ExponentPushToken[0]' });
    expect(tickets[150]).toMatchObject({ status: 'error', error: 'DeviceNotRegistered' });
  });

  it('turns a failed chunk into per-message errors instead of throwing', async () => {
    const sender = new ExpoPushSender({ timeoutMs: 1000, fetch: async () => new Response('busy', { status: 503 }) });
    const tickets = await sender.send(msgs(3));
    expect(tickets.every((t) => t.status === 'error')).toBe(true);
  });

  it('sends the access token when configured', async () => {
    let auth: string | undefined;
    const fetch = async (_u: string, init?: RequestInit) => {
      auth = (init!.headers as Record<string, string>).authorization;
      return new Response(JSON.stringify({ data: [{ status: 'ok' }] }));
    };
    await new ExpoPushSender({ timeoutMs: 1000, fetch, accessToken: 'abc' }).send(msgs(1));
    expect(auth).toBe('Bearer abc');
  });
});
