import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FAVORITES_KEY, MAX_RECENTS, RECENTS_KEY, SavedPlacesProvider, useFavorites } from './useFavorites';

const wrapper = ({ children }: { children: ReactNode }) => <SavedPlacesProvider>{children}</SavedPlacesProvider>;
const seoul = { name: 'Seoul', lat: 37.5665, lon: 126.978 };

describe('useFavorites', () => {
  it('toggles favourites, matching by rounded coordinates, and persists them', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    expect(result.current.favorites).toEqual([]);
    act(() => result.current.toggleFavorite(seoul));
    expect(result.current.favorites).toEqual([{ name: 'Seoul', lat: 37.57, lon: 126.98 }]);
    expect(result.current.isFavorite({ lat: 37.57, lon: 126.98 })).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(FAVORITES_KEY)!)).toHaveLength(1);
    act(() => result.current.toggleFavorite({ name: 'Seoul (again)', lat: 37.57, lon: 126.98 }));
    expect(result.current.favorites).toEqual([]);
  });

  it('keeps recents de-duplicated, most recent first, capped', () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => {
      for (let i = 0; i < MAX_RECENTS + 3; i++) result.current.addRecent({ name: `P${i}`, lat: i, lon: i });
      result.current.addRecent({ name: 'P2 again', lat: 2, lon: 2 });
    });
    expect(result.current.recents).toHaveLength(MAX_RECENTS);
    expect(result.current.recents[0].name).toBe('P2 again');
    expect(result.current.recents.filter((r) => r.lat === 2)).toHaveLength(1);
    act(() => result.current.clearRecents());
    expect(result.current.recents).toEqual([]);
    expect(window.localStorage.getItem(RECENTS_KEY)).toBe('[]');
  });

  it('loads persisted data and ignores corrupt entries', () => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([seoul, { nope: true }, 'x']));
    window.localStorage.setItem(RECENTS_KEY, '{not json');
    const { result } = renderHook(() => useFavorites(), { wrapper });
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.recents).toEqual([]);
  });

  it('survives localStorage throwing', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const { result } = renderHook(() => useFavorites(), { wrapper });
    expect(result.current.favorites).toEqual([]);
    act(() => result.current.toggleFavorite(seoul));
    expect(result.current.favorites).toHaveLength(1);
    get.mockRestore();
    set.mockRestore();
  });
});
