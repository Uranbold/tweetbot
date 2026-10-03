import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Animates a number from its previous value to `target` (UX §3.8: hero temperature counts to the
 * new value over 320 ms on location change). Instant under prefers-reduced-motion or on first render.
 */
export function useCountUp(target: number, durationMs = 320): number {
  const [value, setValue] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const ease = (t: number) => 1 - (1 - t) ** 3;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(from + (target - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}
