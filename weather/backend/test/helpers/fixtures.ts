import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../fixtures/', import.meta.url));

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(`${dir}${name}`, 'utf8')) as T;
}

/** Instant at which the Ulaanbaatar fixtures were recorded (22:15 local, UTC+8). */
export const RECORDED_AT = new Date('2026-10-01T14:15:00Z');

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Fake fetch serving the recorded Open-Meteo fixtures, routed by URL. Records requested URLs. */
export function fixtureFetch() {
  const calls: string[] = [];
  const fn = async (input: string): Promise<Response> => {
    calls.push(input);
    const url = new URL(input);
    if (url.hostname.startsWith('air-quality')) {
      return jsonResponse(url.searchParams.get('latitude')!.includes(',') ? multiAir(url) : fixture('air-quality-ulaanbaatar.json'));
    }
    if (url.hostname.startsWith('geocoding')) return jsonResponse(fixture('geocoding-seoul.json'));
    if (url.searchParams.has('models')) return jsonResponse(fixture('compare-ulaanbaatar.json'));
    if (url.searchParams.get('latitude')!.includes(',')) return jsonResponse(multiSnapshots(url));
    return jsonResponse(fixture('forecast-ulaanbaatar.json'));
  };
  return { fetch: fn, calls };
}

/** Expand the recorded 2-location snapshot fixture to however many locations were requested. */
function multiSnapshots(url: URL) {
  const n = url.searchParams.get('latitude')!.split(',').length;
  const rec = fixture<unknown[]>('snapshots-korea2.json');
  return Array.from({ length: n }, (_, i) => rec[i % rec.length]);
}

function multiAir(url: URL) {
  const n = url.searchParams.get('latitude')!.split(',').length;
  const rec = fixture<unknown[]>('air-current-korea2.json');
  return Array.from({ length: n }, (_, i) => rec[i % rec.length]);
}

export const RATE_LIMITED_BODY = { error: true, reason: 'Daily API request limit exceeded. Please try again tomorrow.' };
