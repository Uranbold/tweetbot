import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readJson, writeJson } from '../lib/storage';
import { placeKey, toPlace, type Place } from '../lib/places';

export const FAVORITES_KEY = 'skycast:favorites';
export const RECENTS_KEY = 'skycast:recents';
export const MAX_RECENTS = 8;
export const MAX_FAVORITES = 20;

function isPlace(v: unknown): v is Place {
  const p = v as Place;
  return !!p && typeof p.name === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

function load(key: string, max: number): Place[] {
  const raw = readJson<unknown>(key, []);
  return Array.isArray(raw) ? raw.filter(isPlace).slice(0, max) : [];
}

interface SavedPlacesValue {
  favorites: Place[];
  recents: Place[];
  isFavorite: (p: { lat: number; lon: number }) => boolean;
  toggleFavorite: (p: Place) => void;
  removeFavorite: (p: { lat: number; lon: number }) => void;
  addRecent: (p: Place) => void;
  removeRecent: (p: { lat: number; lon: number }) => void;
  clearRecents: () => void;
}

const SavedPlacesContext = createContext<SavedPlacesValue | null>(null);

/** Favourites (관심지역) and recently viewed places, persisted to localStorage. */
export function SavedPlacesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Place[]>(() => load(FAVORITES_KEY, MAX_FAVORITES));
  const [recents, setRecents] = useState<Place[]>(() => load(RECENTS_KEY, MAX_RECENTS));

  useEffect(() => writeJson(FAVORITES_KEY, favorites), [favorites]);
  useEffect(() => writeJson(RECENTS_KEY, recents), [recents]);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_KEY) setFavorites(load(FAVORITES_KEY, MAX_FAVORITES));
      if (e.key === RECENTS_KEY) setRecents(load(RECENTS_KEY, MAX_RECENTS));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const favKeys = useMemo(() => new Set(favorites.map(placeKey)), [favorites]);

  const isFavorite = useCallback((p: { lat: number; lon: number }) => favKeys.has(placeKey(p)), [favKeys]);

  const toggleFavorite = useCallback((p: Place) => {
    const key = placeKey(p);
    setFavorites((prev) =>
      prev.some((f) => placeKey(f) === key) ? prev.filter((f) => placeKey(f) !== key) : [toPlace(p), ...prev].slice(0, MAX_FAVORITES),
    );
  }, []);

  const removeFavorite = useCallback((p: { lat: number; lon: number }) => {
    const key = placeKey(p);
    setFavorites((prev) => prev.filter((f) => placeKey(f) !== key));
  }, []);

  const addRecent = useCallback((p: Place) => {
    const key = placeKey(p);
    setRecents((prev) => [toPlace(p), ...prev.filter((r) => placeKey(r) !== key)].slice(0, MAX_RECENTS));
  }, []);

  const removeRecent = useCallback((p: { lat: number; lon: number }) => {
    const key = placeKey(p);
    setRecents((prev) => prev.filter((r) => placeKey(r) !== key));
  }, []);

  const clearRecents = useCallback(() => setRecents([]), []);

  const value = useMemo(
    () => ({ favorites, recents, isFavorite, toggleFavorite, removeFavorite, addRecent, removeRecent, clearRecents }),
    [favorites, recents, isFavorite, toggleFavorite, removeFavorite, addRecent, removeRecent, clearRecents],
  );
  return <SavedPlacesContext.Provider value={value}>{children}</SavedPlacesContext.Provider>;
}

export function useSavedPlaces(): SavedPlacesValue {
  const ctx = useContext(SavedPlacesContext);
  if (!ctx) throw new Error('useSavedPlaces must be used inside <SavedPlacesProvider>');
  return ctx;
}

/** Alias matching the feature name. */
export const useFavorites = useSavedPlaces;
