import { useState } from 'react';
import type { WeatherAlert } from '@contract';
import { SEVERITY_LABELS } from '../../lib/levels';
import { datePart, formatClock, formatMonthDay } from '../../lib/format';

function when(a: WeatherAlert): string {
  const fmt = (iso: string) => `${formatMonthDay(datePart(iso))} ${formatClock(iso)}`;
  return a.end ? `${fmt(a.start)} – ${datePart(a.end) === datePart(a.start) ? formatClock(a.end) : fmt(a.end)}` : `From ${fmt(a.start)}`;
}

/** Advisory: outline ▲. Warning: ⚠ in a filled badge. */
function SeverityGlyph({ severity }: { severity: WeatherAlert['severity'] }) {
  return severity === 'warning' ? (
    <svg className="alert__glyph alert__glyph--filled" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path d="M12 5.5l7 12.5H5z" fill="none" stroke="var(--surface)" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M12 10.5v3.5M12 16.2v.1" stroke="var(--surface)" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ) : (
    <svg className="alert__glyph" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 3.5l9 16H3z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function AlertItem({ a }: { a: WeatherAlert }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={`alert alert--${a.severity}`} role={a.severity === 'warning' ? 'alert' : undefined} data-severity={a.severity}>
      <SeverityGlyph severity={a.severity} />
      <div className="alert__body">
        <p className="alert__title">
          <span className="alert__tag">{SEVERITY_LABELS[a.severity]}</span>
          {a.title}
        </p>
        <p className="alert__meta">
          {when(a)} · {a.source === 'official' ? 'Official bulletin' : 'Derived from forecast'}
        </p>
        {open && <p className="alert__desc">{a.description}</p>}
      </div>
      <button type="button" className="alert__more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Less' : 'Why'}
      </button>
    </article>
  );
}

/** UX §4.2: shown only with alerts; stacks ≤ 2, the rest summarised "+N more". No dismiss (safety). */
export function AlertsBanner({ alerts }: { alerts: WeatherAlert[] }) {
  const [all, setAll] = useState(false);
  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort((a, b) => Number(b.severity === 'warning') - Number(a.severity === 'warning'));
  const visible = all ? sorted : sorted.slice(0, 2);
  const hidden = sorted.length - visible.length;
  return (
    <section className="alerts" aria-label="Weather alerts">
      {visible.map((a, i) => (
        <AlertItem key={`${a.type}-${i}`} a={a} />
      ))}
      {hidden > 0 && (
        <button type="button" className="link-btn alerts__more" onClick={() => setAll(true)}>
          +{hidden} more alert{hidden > 1 ? 's' : ''}
        </button>
      )}
    </section>
  );
}
