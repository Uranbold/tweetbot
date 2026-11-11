import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocationSearch } from '../../api/hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSavedPlaces } from '../../hooks/useFavorites';
import { PRESETS, placeKey, placeSubtitle, toPlace, type Place } from '../../lib/places';
import { ClockIcon, CloseIcon, PinIcon, SearchIcon, StarIcon } from '../icons/UiIcons';

type Kind = 'result' | 'favorite' | 'recent' | 'preset';
interface Option {
  key: string;
  kind: Kind;
  place: Place;
}

const GROUP_LABEL: Record<Kind, string> = {
  result: 'Results',
  favorite: 'Favorites',
  recent: 'Recent',
  preset: 'Popular',
};

/** Postel's law: "47.92, 106.92" (or "47.92 106.92") resolves directly. */
export function parseCoords(text: string): Place | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}

export function SearchBox({ onSelect, debounceMs = 150 }: { onSelect: (p: Place) => void; debounceMs?: number }) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounced = useDebouncedValue(value, debounceMs);
  const term = debounced.trim();
  const coords = parseCoords(value);
  const search = useLocationSearch(coords ? '' : term);
  const { favorites, recents, clearRecents, isFavorite, toggleFavorite } = useSavedPlaces();

  const typing = value.trim().length > 0;
  const options: Option[] = useMemo(() => {
    if (typing) {
      if (coords) return [{ key: 'coords', kind: 'result' as const, place: coords }];
      // While a new term loads, the previous term's results stay visible (placeholderData).
      const results = search.data?.data ?? [];
      return results.map((l) => ({ key: `r-${l.id}`, kind: 'result' as const, place: toPlace(l) }));
    }
    const seen = new Set<string>();
    const out: Option[] = [];
    const push = (kind: Kind, list: Place[]) => {
      for (const p of list) {
        const k = placeKey(p);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ key: `${kind}-${k}`, kind, place: p });
      }
    };
    push('favorite', favorites);
    push('recent', recents.slice(0, 5));
    push('preset', PRESETS);
    return out;
  }, [typing, coords?.lat, coords?.lon, search.data, favorites, recents]);

  const choose = (opt: Option | undefined) => {
    if (!opt) return;
    onSelect(opt.place);
    setValue('');
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) setOpen(true);
        setActive((a) => (options.length ? (a + 1) % options.length : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!open) setOpen(true);
        setActive((a) => (options.length ? (a <= 0 ? options.length - 1 : a - 1) : -1));
        break;
      case 'Enter':
        if (open && options.length) {
          e.preventDefault();
          choose(options[active >= 0 ? active : 0]);
        }
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (value) {
          setValue('');
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const loading = typing && !coords && (value.trim() !== term || search.isFetching);
  const showList = open && (options.length > 0 || typing);
  const activeId = active >= 0 && options[active] ? `${id}-opt-${active}` : undefined;

  let lastKind: Kind | null = null;
  return (
    <div className="search" role="search">
      <label htmlFor={`${id}-input`} className="visually-hidden">
        Search for a city
      </label>
      <SearchIcon size={18} className="search__icon" />
      <input
        ref={inputRef}
        id={`${id}-input`}
        className="search__input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={activeId}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search city or region"
        value={value}
        maxLength={100}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {value && (
        <button
          type="button"
          className="search__clear icon-btn"
          aria-label="Clear search"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setValue('');
            setActive(-1);
            inputRef.current?.focus();
          }}
        >
          <CloseIcon size={16} />
        </button>
      )}
      <div className={`search__panel${showList ? ' is-open' : ''}`} onMouseDown={(e) => e.preventDefault()}>
        <ul id={listId} role="listbox" aria-label="Locations" className="search__list">
          {options.map((o, i) => {
            const header = o.kind !== lastKind && !typing ? GROUP_LABEL[o.kind] : null;
            lastKind = o.kind;
            const sub = placeSubtitle(o.place);
            return (
              <li
                key={o.key}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                className={`search__opt${i === active ? ' is-active' : ''}${header ? ' has-group' : ''}`}
                data-group={header ?? undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
              >
                <span className="search__opt-icon" aria-hidden="true">
                  {o.kind === 'favorite' ? <StarIcon size={16} filled /> : o.kind === 'recent' ? <ClockIcon size={16} /> : <PinIcon size={16} />}
                </span>
                <span className="search__opt-text">
                  <span className="search__opt-name">{o.place.name}</span>
                  {sub && <span className="search__opt-sub">{sub}</span>}
                </span>
                {o.kind === 'result' && (
                  // Pointer shortcut; keyboard users favourite from the location card's star.
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`search__star${isFavorite(o.place) ? ' is-on' : ''}`}
                    aria-label={isFavorite(o.place) ? `Remove ${o.place.name} from favorites` : `Add ${o.place.name} to favorites`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(o.place);
                    }}
                  >
                    <StarIcon size={16} filled={isFavorite(o.place)} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {typing && !loading && options.length === 0 && (
          <p className="search__empty">{search.isError ? 'Search is unavailable right now.' : `No places found for “${value.trim()}”.`}</p>
        )}
        {typing && loading && options.length === 0 && <p className="search__empty">Searching…</p>}
        {!typing && recents.length > 0 && (
          <button type="button" className="search__clear-recents" onClick={clearRecents}>
            Clear recent locations
          </button>
        )}
      </div>
      <span className="visually-hidden" aria-live="polite">
        {open && typing && !loading ? `${options.length} result${options.length === 1 ? '' : 's'}` : ''}
      </span>
    </div>
  );
}
