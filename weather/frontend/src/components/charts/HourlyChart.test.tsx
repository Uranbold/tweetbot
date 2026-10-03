import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dayBoundaries, HourlyChart } from './HourlyChart';
import { HourlyCard } from '../cards/HourlyCard';
import { fixtures } from '../../__fixtures__/handler';

const hourly = fixtures.weather.data.hourly;

describe('HourlyChart', () => {
  it('renders one temperature point and one column per hour', () => {
    render(<HourlyChart hourly={hourly} metric="temperature" today="2026-10-01" />);
    expect(screen.getAllByTestId('hourly-point')).toHaveLength(48);
    expect(within(screen.getByRole('list', { name: 'Hourly forecast' })).getAllByRole('listitem')).toHaveLength(48);
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('renders N points for shorter series and sizes the strip by column', () => {
    render(<HourlyChart hourly={hourly.slice(0, 12)} metric="temperature" today="2026-10-01" colWidth={50} />);
    expect(screen.getAllByTestId('hourly-point')).toHaveLength(12);
    expect(screen.getByTestId('hourly-chart').style.width).toBe('600px');
  });

  it('labels day boundaries', () => {
    expect(dayBoundaries(hourly)).toEqual([0, 10, 34]);
    render(<HourlyChart hourly={hourly} metric="temperature" today="2026-10-01" />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Sat Oct 3')).toBeInTheDocument();
  });

  it('exposes exactly 4 metric toggles (Hick) and switches the plotted metric', async () => {
    render(<HourlyCard hourly={hourly} today="2026-10-01" />);
    const group = screen.getByRole('group', { name: 'Hourly metric' });
    const toggles = within(group).getAllByRole('button');
    expect(toggles.map((b) => b.textContent)).toEqual(['Temp', 'Rain', 'Humidity', 'Wind']);
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(toggles[1]);
    expect(toggles[1]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByTestId('hourly-point')).toHaveLength(0);
    // Only wet hours draw a bar; bars are baseline-anchored paths.
    const bars = screen.getAllByTestId('hourly-bar');
    expect(bars).toHaveLength(hourly.filter((h) => h.precipitation > 0).length);
    expect(bars[0].tagName).toBe('path');
    await userEvent.click(toggles[2]);
    expect(screen.getAllByTestId('hourly-bar')).toHaveLength(48);
  });

  it('offers a table view of the same data', async () => {
    render(<HourlyCard hourly={hourly} today="2026-10-01" />);
    await userEvent.click(screen.getByRole('button', { name: 'Table view' }));
    const table = screen.getByRole('region', { name: 'Hourly forecast table' });
    expect(within(table).getAllByRole('row')).toHaveLength(49);
    expect(within(table).getAllByRole('cell')[1]).toHaveTextContent('12°C');
    expect(screen.queryByTestId('hourly-chart')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Chart view' }));
    expect(screen.getByTestId('hourly-chart')).toBeInTheDocument();
  });

  it('moves a crosshair tooltip with the arrow keys', async () => {
    render(<HourlyChart hourly={hourly} metric="temperature" today="2026-10-01" />);
    const region = screen.getByRole('region', { name: /Hourly forecast, scrollable/ });
    region.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    const tip = screen.getByText('Today · 3 PM').closest('.chart-tip')!;
    expect(tip).toHaveTextContent('Feels');
    expect(screen.getAllByRole('listitem')[1]).toHaveClass('is-active');
    await userEvent.keyboard('{End}');
    expect(screen.getByText(/Sat Oct 3 · 1 PM/)).toBeInTheDocument();
  });
});
