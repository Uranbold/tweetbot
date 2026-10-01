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

  it('switches metric via keyboard-accessible tabs', async () => {
    render(<HourlyCard hourly={hourly} today="2026-10-01" />);
    const tab = screen.getByRole('tab', { name: 'Temperature' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    tab.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Precipitation' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryAllByTestId('hourly-point')).toHaveLength(0);
    // Only wet hours draw a bar.
    expect(screen.getAllByTestId('hourly-bar')).toHaveLength(hourly.filter((h) => h.precipitation > 0).length);
    await userEvent.click(screen.getByRole('tab', { name: 'Humidity' }));
    expect(screen.getAllByTestId('hourly-bar')).toHaveLength(48);
  });
});
