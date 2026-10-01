import { describe, expect, it } from 'vitest';
import { MemoryLruCache } from '../../src/cache/memory.js';
import { ReadThroughCache } from '../../src/cache/readThrough.js';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (s: number) => (t += s * 1000) };
}

describe('MemoryLruCache', () => {
  it('expires entries after ttl + stale retention', async () => {
    const c = clock();
    const cache = new MemoryLruCache(10, c.now);
    await cache.set('k', 1, 10, 5);
    expect((await cache.get('k'))?.value).toBe(1);
    c.advance(12); // expired but retained
    const e = await cache.get('k');
    expect(e?.value).toBe(1);
    expect(c.now() >= e!.expiresAt).toBe(true);
    c.advance(4); // 16 s > 10 + 5
    expect(await cache.get('k')).toBeUndefined();
    expect(await cache.size()).toBe(0);
  });

  it('evicts the least recently used entry', async () => {
    const cache = new MemoryLruCache(2);
    await cache.set('a', 1, 60, 0);
    await cache.set('b', 2, 60, 0);
    await cache.get('a'); // a is now most recent
    await cache.set('c', 3, 60, 0);
    expect(await cache.get('b')).toBeUndefined();
    expect((await cache.get('a'))?.value).toBe(1);
    expect((await cache.get('c'))?.value).toBe(3);
  });

  it('supports delete and clear', async () => {
    const cache = new MemoryLruCache();
    await cache.set('a', 1, 60, 0);
    await cache.set('b', 1, 60, 0);
    await cache.delete('a');
    expect(await cache.size()).toBe(1);
    await cache.clear();
    expect(await cache.size()).toBe(0);
  });
});

describe('ReadThroughCache', () => {
  const setup = (staleSeconds = 3600) => {
    const c = clock();
    const rt = new ReadThroughCache(new MemoryLruCache(100, c.now), staleSeconds, c.now);
    return { c, rt };
  };

  it('MISS then HIT with remaining max-age, then reload after TTL', async () => {
    const { c, rt } = setup();
    let calls = 0;
    const load = async () => ++calls;
    expect(await rt.getOrLoad('k', load, { ttlSeconds: 60 })).toEqual({ value: 1, status: 'MISS', maxAge: 60 });
    c.advance(20);
    expect(await rt.getOrLoad('k', load, { ttlSeconds: 60 })).toEqual({ value: 1, status: 'HIT', maxAge: 40 });
    c.advance(41);
    expect(await rt.getOrLoad('k', load, { ttlSeconds: 60 })).toMatchObject({ value: 2, status: 'MISS' });
    expect(rt.snapshot()).toMatchObject({ hits: 1, misses: 2, stale: 0 });
  });

  it('serves the last value as STALE when a refresh fails (stale-while-error)', async () => {
    const { c, rt } = setup(600);
    await rt.getOrLoad('k', async () => 'good', { ttlSeconds: 60 });
    c.advance(61);
    const r = await rt.getOrLoad('k', async () => { throw new Error('upstream down'); }, { ttlSeconds: 60 });
    expect(r).toMatchObject({ value: 'good', status: 'STALE' });
    expect(rt.snapshot().stale).toBe(1);
  });

  it('rethrows when nothing is retained', async () => {
    const { c, rt } = setup(10);
    await expect(rt.getOrLoad('k', async () => { throw new Error('boom'); }, { ttlSeconds: 60 })).rejects.toThrow('boom');
    await rt.getOrLoad('k', async () => 'v', { ttlSeconds: 60 });
    c.advance(71); // beyond ttl + stale retention
    await expect(rt.getOrLoad('k', async () => { throw new Error('boom'); }, { ttlSeconds: 60 })).rejects.toThrow('boom');
  });

  it('coalesces concurrent loads for the same key (single-flight)', async () => {
    const { rt } = setup();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const load = async () => {
      calls++;
      await gate;
      return 'v';
    };
    const pending = Array.from({ length: 50 }, () => rt.getOrLoad('hot', load, { ttlSeconds: 60 }));
    await Promise.resolve();
    expect(rt.snapshot().inflight).toBe(1);
    release();
    const results = await Promise.all(pending);
    expect(calls).toBe(1);
    expect(results.every((r) => r.value === 'v')).toBe(true);
    expect(rt.snapshot().inflight).toBe(0);
    // different keys are not coalesced
    await Promise.all([rt.getOrLoad('a', load, { ttlSeconds: 60 }), rt.getOrLoad('b', load, { ttlSeconds: 60 })]);
    expect(calls).toBe(3);
  });

  it('shares a failure with every waiter and clears the in-flight slot', async () => {
    const { rt } = setup();
    let calls = 0;
    const load = async () => {
      calls++;
      throw new Error('nope');
    };
    const rs = await Promise.allSettled([rt.getOrLoad('k', load, { ttlSeconds: 60 }), rt.getOrLoad('k', load, { ttlSeconds: 60 })]);
    expect(rs.every((r) => r.status === 'rejected')).toBe(true);
    expect(calls).toBe(1);
    await expect(rt.getOrLoad('k', async () => 'ok', { ttlSeconds: 60 })).resolves.toMatchObject({ value: 'ok' });
  });

  it('prefers a retained real value over a fresh degraded (mock) value, and caps degraded TTL', async () => {
    const { c, rt } = setup();
    const opts = { ttlSeconds: 600, degraded: (v: { mock: boolean }) => v.mock, degradedTtlSeconds: 120 };
    await rt.getOrLoad('k', async () => ({ mock: false, n: 1 }), opts);
    c.advance(601);
    const r = await rt.getOrLoad('k', async () => ({ mock: true, n: 2 }), opts);
    expect(r).toMatchObject({ status: 'STALE', value: { mock: false, n: 1 } });

    // With no real value retained, the degraded value is cached for the shorter TTL.
    const m = await rt.getOrLoad('other', async () => ({ mock: true, n: 3 }), opts);
    expect(m).toMatchObject({ status: 'MISS', maxAge: 120 });
    c.advance(121);
    expect((await rt.getOrLoad('other', async () => ({ mock: false, n: 4 }), opts)).value.n).toBe(4);
  });
});
