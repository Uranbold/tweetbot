import { useEffect, useRef, useState } from 'react';
import { announce } from './useMotion';
import type { SyncStatus } from '@/store/reducer';

/** Shows a "Saved" check for a short while after an autosave completes, and announces it (UX §4.9, §5). */
export function useSavedFlag(status: SyncStatus, savedLabel: string, holdMs = 2500): { saved: boolean; syncing: boolean } {
  const [saved, setSaved] = useState(false);
  const prev = useRef<SyncStatus>(status);
  useEffect(() => {
    if (status === 'synced' && prev.current !== 'synced') {
      setSaved(true);
      announce(savedLabel);
      const timer = setTimeout(() => setSaved(false), holdMs);
      prev.current = status;
      return () => clearTimeout(timer);
    }
    prev.current = status;
    return undefined;
  }, [status, savedLabel, holdMs]);
  return { saved, syncing: status === 'syncing' };
}
