import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DEFAULT_PLACE, placeSearch, toPlace, type Place } from '../lib/places';
import { useSavedPlaces } from './useFavorites';

function parseCoord(raw: string | null, limit: number): number | null {
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

/** Reads the selected place from `?lat=&lon=&name=`; falls back to Ulaanbaatar. */
export function placeFromParams(sp: URLSearchParams): { place: Place; isDefault: boolean } {
  const lat = parseCoord(sp.get('lat'), 90);
  const lon = parseCoord(sp.get('lon'), 180);
  if (lat == null || lon == null) return { place: DEFAULT_PLACE, isDefault: true };
  const name = sp.get('name')?.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  return { place: { name, lat, lon }, isDefault: false };
}

/** Params (other than the location) that a page keeps when the location changes. */
const KEEP_PARAMS = ['models', 'region', 'layer'];

export function useLocationState() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { addRecent } = useSavedPlaces();

  const { place, isDefault } = useMemo(() => placeFromParams(searchParams), [searchParams]);

  /** Selects a place on the current page (or `to` path) and records it in recents. */
  const selectPlace = useCallback(
    (p: Place, to?: string) => {
      const next = toPlace(p);
      addRecent(next);
      const extra: Record<string, string> = {};
      if (!to) {
        for (const k of KEEP_PARAMS) {
          const v = searchParams.get(k);
          if (v) extra[k] = v;
        }
      }
      // The map page has no per-location view; selecting a place there goes Home.
      const target = to ?? (pathname.startsWith('/map') ? '/' : pathname);
      navigate({ pathname: target, search: placeSearch(next, extra) });
    },
    [addRecent, navigate, pathname, searchParams],
  );

  /** Query string for links to other tabs that keeps the selected place. */
  const locationSearch = isDefault ? '' : placeSearch(place);

  return { place, isDefault, selectPlace, locationSearch };
}
