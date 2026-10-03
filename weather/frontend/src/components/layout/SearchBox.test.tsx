import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from './SearchBox';
import { renderWithProviders } from '../../test/utils';
import { createFixtureFetch } from '../../__fixtures__/handler';
import { RECENTS_KEY } from '../../hooks/useFavorites';

describe('SearchBox autocomplete', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(createFixtureFetch());
    vi.stubGlobal('fetch', fetchMock);
  });

  it('queries the search endpoint and selects with ArrowDown + Enter', async () => {
    const onSelect = vi.fn();
    renderWithProviders(<SearchBox onSelect={onSelect} debounceMs={10} />);
    const input = screen.getByRole('combobox', { name: 'Search for a city' });
    await userEvent.type(input, 'se');
    await screen.findByRole('option', { name: /Seoul/ });
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('/api/v1/locations/search?q=se&limit=8');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    const options = screen.getAllByRole('option');
    await userEvent.keyboard('{ArrowDown}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    await userEvent.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    // Wraps around to the last option.
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ name: 'Seoul', lat: 37.57, lon: 126.98 });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape closes the list, a second Escape clears the input', async () => {
    renderWithProviders(<SearchBox onSelect={() => {}} debounceMs={10} />);
    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'tok');
    await screen.findByRole('option', { name: /Tokyo/ });
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('tok');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
  });

  it('shows recents and presets when empty, and a no-results message', async () => {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([{ name: 'Busan', lat: 35.1, lon: 129.04 }]));
    const onSelect = vi.fn();
    renderWithProviders(<SearchBox onSelect={onSelect} debounceMs={10} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names[0]).toContain('Busan');
    expect(names.some((n) => n?.includes('New York'))).toBe(true);
    await userEvent.keyboard('{Enter}');
    expect(onSelect.mock.calls[0][0]).toMatchObject({ name: 'Busan' });

    await userEvent.type(input, 'zzzz');
    await waitFor(() => expect(screen.getByText(/No places found/)).toBeInTheDocument());
  });
});
