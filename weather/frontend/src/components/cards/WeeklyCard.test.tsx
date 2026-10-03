import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeeklyCard } from './WeeklyCard';
import { fixtures } from '../../__fixtures__/handler';

describe('WeeklyCard', () => {
  const daily = fixtures.weather.data.daily;

  it('shows 7 rows first, then all 10 behind "Show 10 days" (Miller)', async () => {
    render(<WeeklyCard daily={daily} today="2026-10-01" />);
    const rows = screen.getAllByTestId('week-row');
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent('Today');
    expect(rows[1]).toHaveTextContent('Tomorrow');
    expect(rows[2]).toHaveTextContent('Sat');
    const more = screen.getByRole('button', { name: 'Show 10 days' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    expect(screen.getAllByTestId('week-row')).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Show 7 days' })).toHaveAttribute('aria-expanded', 'true');
  });

  it("marks today's bar with the current temperature and reports row selection", async () => {
    const onSelect = vi.fn();
    render(<WeeklyCard daily={daily} today="2026-10-01" currentTemp={11.4} onSelectDate={onSelect} selectedDate="2026-10-02" />);
    const nows = screen.getAllByTestId('range-now');
    expect(nows).toHaveLength(1);
    // (11.4 - -8.9) / 21 = 96.67%
    expect(nows[0].style.left).toBe('96.66666666666667%');
    const rows = screen.getAllByTestId('week-row');
    expect(rows[1]).toHaveClass('is-selected');
    await userEvent.click(screen.getByRole('button', { name: /Sat/ }));
    expect(onSelect).toHaveBeenCalledWith('2026-10-03');
  });

  it('scales each range bar to the whole week', () => {
    render(<WeeklyCard daily={daily} today="2026-10-01" initialRows={10} />);
    const bars = screen.getAllByTestId('range-bar');
    const weekMin = Math.min(...daily.map((d) => d.temperatureMin));
    const weekMax = Math.max(...daily.map((d) => d.temperatureMax));
    // Day 0: -1.6..12.1 within -8.9..12.1 → left = (−1.6+8.9)/21 = 34.76%, ends at 100%.
    expect(weekMin).toBe(-8.9);
    expect(weekMax).toBe(12.1);
    expect(bars[0].style.left).toBe('34.76%');
    expect(bars[0].style.width).toBe('65.24%');
    // The coldest day starts at the left edge.
    const coldest = daily.findIndex((d) => d.temperatureMin === weekMin);
    expect(bars[coldest].style.left).toBe('0%');
  });
});
