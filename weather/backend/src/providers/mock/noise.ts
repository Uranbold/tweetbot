/** Deterministic pseudo-random helpers (no Math.random anywhere in the mock). */

/** cyrb53-style 32-bit string hash. */
export function hash(str: string): number {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 ^ h1) >>> 0;
}

/** mulberry32 PRNG → floats in [0, 1). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform value in [-1, 1) for a key. */
export function unit(key: string): number {
  return prng(hash(key))() * 2 - 1;
}

/**
 * Smooth quasi-periodic signal: a sum of sines with seeded phases. Continuous in `tDays`
 * (so hour-to-hour and day-to-day values are coherent), deterministic per seed.
 * Output range is roughly ±Σ amplitudes.
 */
export function smooth(seedKey: string, tDays: number, components: readonly (readonly [periodDays: number, amplitude: number])[]): number {
  const rand = prng(hash(seedKey));
  let v = 0;
  for (const [period, amp] of components) v += amp * Math.sin((2 * Math.PI * tDays) / period + rand() * 2 * Math.PI);
  return v;
}
