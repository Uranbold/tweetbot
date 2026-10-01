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
    // Hero temperature: 0 dp on cards (UX §1.3), degree sign in its own span.
    const temp = screen.getByText((_, el) => el?.classList.contains('current__temp') === true && el.textContent === '11°');
    expect(temp).toHaveAttribute('data-value', '11');
    expect(screen.getByText('Mainly clear')).toBeInTheDocument();
    const cmp = screen.getByTestId('comparison');
    expect(cmp).toHaveTextContent('2.3° warmer than yesterday');
    expect(cmp).toHaveClass('is-warmer');
    expect(screen.getByText('Feels like').nextElementSibling).toHaveTextContent('9°');
    expect(screen.getByText('Humidity').nextElementSibling).toHaveTextContent('34%');
    expect(screen.getByText('Wind').nextElementSibling).toHaveTextContent('6.8 m/s');
    expect(screen.getByRole('img', { name: 'Wind from NW' })).toBeInTheDocument();
    expect(screen.getByText('UV').nextElementSibling).toHaveTextContent('3 Moderate');
    expect(screen.getByTestId('decision')).toHaveTextContent('Take an umbrella tomorrow from 4 PM');
    expect(screen.getByText(/Updated 14:00/)).toBeInTheDocument();
  });

  it('renders dust grade chips with face glyph + label and sun chips', () => {
    render(<CurrentSummaryCard weather={base()} />);
    const list = screen.getByRole('list', { name: 'Today at a glance' });
    const chips = within(list).getAllByRole('listitem');
    expect(chips.map((c) => c.textContent)).toEqual(['PM10 · Moderate · 46', 'PM2.5 · Moderate · 23', 'Sunrise 07:13', 'Sunset 18:52']);
    // Grade is never colour alone: every grade chip has an inline-SVG face plus the printed label.
    const gradeChips = within(list).getAllByTestId('grade-chip');
    expect(gradeChips).toHaveLength(2);
    for (const chip of gradeChips) {
      expect(chip).toHaveAttribute('data-grade', 'moderate');
      const face = chip.querySelector('svg.grade-face');
      expect(face).toHaveAttribute('data-face', 'moderate');
      expect(chip.querySelector('.grade-chip__grade')).toHaveTextContent('Moderate');
    }
  });

  it('shows Demo data / Stale flags on the card itself', () => {
    render(<CurrentSummaryCard weather={base()} meta={{ ...fixtures.weather.meta, stale: true }} />);
    expect(screen.getByText('Demo data')).toBeInTheDocument();
    expect(screen.getByText(/^Stale · 14:00$/)).toBeInTheDocument();
    expect(screen.getByText(/Updated 14:00 · stale/)).toBeInTheDocument();
  });

  it('handles colder days and missing air data', () => {
    const w = base();
    w.comparison = { temperatureDiff: -4.1, message: '4.1° colder than yesterday' };
    w.air = null;
    render(<CurrentSummaryCard weather={w} />);
    expect(screen.getByTestId('comparison')).toHaveClass('is-colder');
    const chips = screen.getAllByTestId('grade-chip');
    expect(chips[0]).toHaveTextContent('PM10 · No data');
    expect(chips[0]).toHaveAttribute('data-grade', 'none');
    expect(chips[0].querySelector('svg.grade-face')).toHaveAttribute('data-face', 'none');
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
