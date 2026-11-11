import { useRef, type KeyboardEvent } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Tab-style segmented control (WAI-ARIA tabs pattern: roving tabindex, arrow keys).
 * When `panelId` is omitted it behaves as a radio-like toggle group.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  panelId,
  idPrefix,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  panelId?: string;
  idPrefix?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % options.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(options[next].value);
      refs.current[next]?.focus();
    }
  };
  const tabs = !!panelId;
  return (
    <div className="segmented" role={tabs ? 'tablist' : 'group'} aria-label={label}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={idPrefix ? `${idPrefix}-${o.value}` : undefined}
            type="button"
            role={tabs ? 'tab' : undefined}
            aria-selected={tabs ? selected : undefined}
            aria-pressed={tabs ? undefined : selected}
            aria-controls={tabs ? panelId : undefined}
            tabIndex={tabs ? (selected ? 0 : -1) : undefined}
            className={`segmented__btn${selected ? ' is-selected' : ''}`}
            onClick={() => onChange(o.value)}
            onKeyDown={tabs ? (e) => onKeyDown(e, i) : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
