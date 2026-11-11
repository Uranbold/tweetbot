import { describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../../src/errors.js';
import { FallbackPolicy, FallbackWeatherProvider } from '../../src/providers/fallback.js';
import { MockWeatherProvider } from '../../src/providers/mock/adapters.js';
import type { WeatherProvider } from '../../src/providers/ports.js';
import { rateLimited } from '../helpers/app.js';

const coords = { lat: 37.57, lon: 126.98 };

function liveThatThrows(err: () => Error) {
  const getForecast = vi.fn(async () => { throw err(); });
  const p: WeatherProvider = { name: 'open-meteo', getForecast, getSnapshots: async () => { throw err(); } };
  return { p, getForecast };
}

describe('FallbackPolicy / decorators', () => {
  it('falls back to mock on 429 and reports it', async () => {
    const events: string[] = [];
    const { p } = liveThatThrows(rateLimited);
    const fb = new FallbackWeatherProvider(p, new MockWeatherProvider(), new FallbackPolicy(0, (e) => events.push(e.port)));
    const r = await fb.getForecast(coords);
    expect(r.source.mock).toBe(true);
    expect(events).toEqual(['weather']);
  });

  it.each(['timeout', 'server', 'network', 'parse'] as const)('falls back on %s', async (kind) => {
    const { p } = liveThatThrows(() => new UpstreamError('x', kind, 'fail'));
    const fb = new FallbackWeatherProvider(p, new MockWeatherProvider(), new FallbackPolicy(0));
    expect((await fb.getForecast(coords)).source.provider).toBe('mock');
  });

  it('does not mask client errors or programming errors', async () => {
    const policy = new FallbackPolicy(0);
    await expect(policy.run('x', async () => { throw new UpstreamError('x', 'client', 'bad param'); }, async () => 'mock')).rejects.toThrow('bad param');
    await expect(policy.run('x', async () => { throw new TypeError('bug'); }, async () => 'mock')).rejects.toThrow('bug');
  });

  it('skips the live provider during the cooldown, then retries', async () => {
    let t = 0;
    const policy = new FallbackPolicy(60_000, undefined, () => t);
    const { p, getForecast } = liveThatThrows(rateLimited);
    const fb = new FallbackWeatherProvider(p, new MockWeatherProvider(), policy);
    await fb.getForecast(coords);
    await fb.getForecast(coords);
    expect(getForecast).toHaveBeenCalledTimes(1);
    expect(policy.snapshot()).toMatchObject({ fallbacks: 1, skippedWhileCoolingDown: 1 });
    expect(policy.snapshot().coolingDownUntil).not.toBeNull();
    t += 60_001;
    await fb.getForecast(coords);
    expect(getForecast).toHaveBeenCalledTimes(2);
  });
});
