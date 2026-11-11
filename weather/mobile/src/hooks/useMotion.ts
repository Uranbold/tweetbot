import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { MOTION } from '@/theme';

/** Honour the OS reduce-motion setting (UX §3.8). Defaults to false until the OS answers. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Ease-out cubic-bezier(.2,.8,.2,1) approximation. */
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Counts from the previous value to `target` over `duration` ms (320 ms by default) — the one
 * orchestrated moment on location change. With reduced motion it jumps immediately.
 */
export function useCountUp(target: number, duration: number = MOTION.sheet, reduced = false): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || Platform.OS === 'web' && typeof requestAnimationFrame !== 'function') {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const v = from + (target - from) * ease(p);
      setValue(v);
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      fromRef.current = target;
    };
  }, [target, duration, reduced]);

  return value;
}

/** Polite screen-reader announcement (UX §5 live region). No-op when unsupported. */
export function announce(message: string): void {
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // ignore
  }
}
