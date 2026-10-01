import type { WeatherAlert } from '@contract';
import { WarningIcon } from '../icons/UiIcons';
import { SEVERITY_LABELS } from '../../lib/levels';
import { datePart, formatClock, formatMonthDay } from '../../lib/format';

function when(a: WeatherAlert): string {
  const fmt = (iso: string) => `${formatMonthDay(datePart(iso))} ${formatClock(iso)}`;
  return a.end ? `${fmt(a.start)} – ${datePart(a.end) === datePart(a.start) ? formatClock(a.end) : fmt(a.end)}` : `From ${fmt(a.start)}`;
}

/** Naver "특보" style banner: advisory (주의보) amber, warning (경보) red. */
export function AlertsBanner({ alerts }: { alerts: WeatherAlert[] }) {
  if (alerts.length === 0) return null;
  const sorted = [...alerts].sort((a, b) => Number(b.severity === 'warning') - Number(a.severity === 'warning'));
  return (
    <section className="alerts" aria-label="Weather alerts">
      {sorted.map((a, i) => (
        <article key={`${a.type}-${i}`} className={`alert alert--${a.severity}`} role={a.severity === 'warning' ? 'alert' : undefined}>
          <WarningIcon size={22} className="alert__icon" />
          <div className="alert__body">
            <p className="alert__title">
              <span className="alert__tag">{SEVERITY_LABELS[a.severity]}</span>
              {a.title}
            </p>
            <p className="alert__desc">{a.description}</p>
            <p className="alert__meta">
              {when(a)} · {a.source === 'official' ? 'Official bulletin' : 'Derived from forecast'}
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
