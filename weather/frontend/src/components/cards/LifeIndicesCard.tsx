import type { LifeIndex } from '@contract';
import { Card } from '../common/Card';
import { LEVEL_COLORS, LEVEL_LABELS, LEVEL_STEP } from '../../lib/levels';

/** 생활·보건 지수 — life & health indices. */
export function LifeIndicesCard({ indices }: { indices: LifeIndex[] }) {
  return (
    <Card title="Life & health indices" className="life-card">
      {indices.length === 0 ? (
        <p className="muted">No indices available.</p>
      ) : (
        <ul className="life-grid">
          {indices.map((ix) => (
            <li key={ix.key} className="life-item" style={{ ['--level' as string]: LEVEL_COLORS[ix.level] }} data-level={ix.level}>
              <div className="life-item__top">
                <span className="life-item__label">{ix.label}</span>
                <span className="life-item__level">{LEVEL_LABELS[ix.level]}</span>
              </div>
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
