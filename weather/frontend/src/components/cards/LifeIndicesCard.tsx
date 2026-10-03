import type { ClothingAdvice, LifeIndex } from '@contract';
import { Card } from '../common/Card';
import { ShirtIcon } from '../icons/UiIcons';
import { LEVEL_COLORS, LEVEL_LABELS, LEVEL_STEP } from '../../lib/levels';
import { formatTemp } from '../../lib/format';

/**
 * 오늘 옷차림 + 생활·보건 지수 in one card (Hick: ≤ 8 cards on Home). The outfit line is the
 * "peak" of the page (peak–end rule), so it leads; indices are capped at 8 in rows of 4.
 */
export function LifeIndicesCard({ indices, clothing, min, max }: { indices: LifeIndex[]; clothing?: ClothingAdvice; min?: number; max?: number }) {
  return (
    <Card title="Outfit & life indices" className="life-card">
      {clothing && (
        <section className="clothing" aria-labelledby="outfit-title">
          <span className="clothing__icon" aria-hidden="true">
            <ShirtIcon size={28} />
          </span>
          <div className="clothing__text">
            <h3 id="outfit-title" className="eyebrow">
              Today&apos;s outfit
            </h3>
            <p className="clothing__summary">{clothing.summary}</p>
            {min != null && max != null && (
              <p className="muted small">
                For {formatTemp(min)} to {formatTemp(max)} today
              </p>
            )}
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
        </section>
      )}
      {indices.length === 0 ? (
        <p className="muted">No indices available.</p>
      ) : (
        <ul className="life-grid" aria-label="Life and health indices">
          {indices.slice(0, 8).map((ix) => (
            <li key={ix.key} className="life-item" style={{ ['--level' as string]: LEVEL_COLORS[ix.level] }} data-level={ix.level}>
              <span className="life-item__label">{ix.label}</span>
              <span className="life-item__level">{LEVEL_LABELS[ix.level]}</span>
              <span className="life-meter" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((s) => (
                  <span key={s} className={s <= LEVEL_STEP[ix.level] ? 'is-on' : undefined} />
                ))}
              </span>
              <p className="life-item__advice">{ix.advice}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
