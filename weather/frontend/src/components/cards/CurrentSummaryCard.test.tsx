import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TodayWeather } from '@contract';
import { CurrentSummaryCard } from './CurrentSummaryCard';
import { fixtures } from '../../__fixtures__/handler';

const base = (): TodayWeather => structuredClone(fixtures.weather.data);

describe('CurrentSummaryCard', () => {
  it('shows place, temperature, condition, comparison and details', () => {
    render(<CurrentSummaryCard weather={base()} meta={fixtures.weather.meta} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ulaanbaatar' })).toBeInTheDocument();
    expect(screen.getByText('11.4°')).toBeInTheDocument();
    expect(screen.getByText('Mainly clear')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mainly clear' })).toBeInTheDocument();
    const cmp = screen.getByTestId('comparison');
    expect(cmp).toHaveTextContent('2.3° warmer than yesterday');
    expect(cmp).toHaveClass('is-warmer');
    expect(screen.getByText('Feels like').nextElementSibling).toHaveTextContent('8.9°');
    expect(screen.getByText('Humidity').nextElementSibling).toHaveTextContent('34%');
    expect(screen.getByText('Wind').nextElementSibling).toHaveTextContent('NW 6.8 m/s');
    expect(screen.getByText(/Updated 14:00 local time/)).toBeInTheDocument();
  });

  it('renders dust, UV and sun chips', () => {
    render(<CurrentSummaryCard weather={base()} />);
    const chips = within(screen.getByRole('list', { name: 'Today at a glance' })).getAllByRole('listitem');
    expect(chips.map((c) => c.textContent)).toEqual([
      'Fine dust Moderate',
      'Ultra-fine dust Moderate',
      'UV Moderate',
      'Sunrise 07:13',
      'Sunset 18:52',
    ]);
  });

  it('handles colder days and missing air data', () => {
    const w = base();
    w.comparison = { temperatureDiff: -4.1, message: '4.1° colder than yesterday' };
    w.air = null;
    render(<CurrentSummaryCard weather={w} />);
    expect(screen.getByTestId('comparison')).toHaveClass('is-colder');
    expect(screen.getByText('Fine dust').parentElement).toHaveTextContent('No data');
  });

  it('toggles favourite via the star button', async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<CurrentSummaryCard weather={base()} onToggleFavorite={onToggle} />);
    const star = screen.getByRole('button', { name: 'Add Ulaanbaatar to favorites' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(star);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<CurrentSummaryCard weather={base()} onToggleFavorite={onToggle} isFavorite />);
    expect(screen.getByRole('button', { name: 'Remove Ulaanbaatar from favorites' })).toHaveAttribute('aria-pressed', 'true');
  });
});
