import { useEffect, useState } from 'react';
import { readTheme, saveTheme, type ThemeChoice } from '../../lib/theme';

const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };

function Glyph({ choice }: { choice: ThemeChoice }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {choice === 'light' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </>
      )}
      {choice === 'dark' && <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />}
      {choice === 'system' && (
        <>
          <rect x="3" y="4.5" width="18" height="12" rx="2" />
          <path d="M8.5 20h7M12 16.5V20" />
          <path d="M12 7.5v6" />
          <path d="M12 7.5a3 3 0 0 1 0 6z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

/** Cycles System → Light → Dark; persisted in localStorage and applied as `data-theme` on <html>. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(() => readTheme());
  useEffect(() => saveTheme(choice), [choice]);
  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
  return (
    <button
      type="button"
      className="icon-btn theme-btn"
      onClick={() => setChoice(next)}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[choice]}`}
      data-theme-choice={choice}
    >
      <Glyph choice={choice} />
    </button>
  );
}
