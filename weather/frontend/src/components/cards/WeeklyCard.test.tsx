import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeeklyCard } from './WeeklyCard';
import { fixtures } from '../../__fixtures__/handler';

describe('WeeklyCard', () => {
  const daily = fixtures.weather.data.daily;

  it('renders one row per day with relative labels', () => {
    render(<WeeklyCard daily={daily} today="2026-10-01" />);
    const rows = screen.getAllByTestId('week-row');
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveTextContent('Today');
    expect(rows[1]).toHaveTextContent('Tomorrow');
    expect(rows[2]).toHaveTextContent('Sat');
  });

  it('scales each range bar to the whole week', () => {
    render(<WeeklyCard daily={daily} today="2026-10-01" />);
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
