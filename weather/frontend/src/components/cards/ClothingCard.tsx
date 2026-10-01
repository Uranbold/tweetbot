import type { ClothingAdvice } from '@contract';
import { Card } from '../common/Card';
import { ShirtIcon } from '../icons/UiIcons';
import { formatTemp } from '../../lib/format';

/** 오늘 옷차림 — today's outfit. */
export function ClothingCard({ clothing, min, max }: { clothing: ClothingAdvice; min: number; max: number }) {
  return (
    <Card title="Today's outfit" className="clothing-card">
      <div className="clothing">
        <span className="clothing__icon" aria-hidden="true">
          <ShirtIcon size={30} />
        </span>
        <div>
          <p className="clothing__summary">{clothing.summary}</p>
          <p className="muted small">
            For {formatTemp(min)} to {formatTemp(max)} today
          </p>
        </div>
      </div>
      {clothing.items.length > 0 && (
        <ul className="tag-list" aria-label="Suggested items">
          {clothing.items.map((it) => (
            <li key={it} className="tag">
              {it}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
