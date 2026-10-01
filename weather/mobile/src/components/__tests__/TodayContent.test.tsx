import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TodayContent } from '../today/TodayContent';
import { fixtureMeta, weatherFixture } from '@/__fixtures__/weather';
import { en } from '@/i18n/dictionaries';

describe('TodayContent (Today screen body)', () => {
  const renderToday = () => render(<TodayContent weather={weatherFixture} meta={fixtureMeta} t={en} locale="en" placeLabel="Ulaanbaatar" />);

  it('renders the hero temperature, condition and yesterday comparison', async () => {
    await renderToday();
    expect(screen.getByTestId('hero-temp')).toHaveTextContent('12°');
    expect(screen.getByText('Partly cloudy')).toBeTruthy();
    expect(screen.getByTestId('yesterday-diff')).toHaveTextContent('2.3° warmer than yesterday');
    expect(screen.getByText('Partly cloudy, rain likely after 6 PM')).toBeTruthy();
  });

  it('shows air grade chips with face glyphs and labels', async () => {
    await renderToday();
    expect(screen.getByTestId('grade-chip-bad')).toBeTruthy();
    expect(screen.getByTestId('grade-face-bad')).toBeTruthy();
    expect(screen.getByTestId('grade-chip-moderate')).toBeTruthy();
  });

  it('renders alert banners: warning with stripe, advisory without', async () => {
    await renderToday();
    const warning = screen.getByTestId('alert-banner-warning');
    const advisory = screen.getByTestId('alert-banner-advisory');
    expect(warning).toHaveStyle({ borderLeftWidth: 4 });
    expect(advisory).not.toHaveStyle({ borderLeftWidth: 4 });
    // Tap expands the threshold rationale.
    await fireEvent.press(warning);
    expect(warning).toHaveTextContent(/PM10 above 150/);
  });

  it('renders the hourly strip and the weekly list with 7 rows plus "Show 10 days"', async () => {
    await renderToday();
    expect(screen.getByTestId('hourly-strip')).toBeTruthy();
    expect(screen.getAllByTestId('range-bar')).toHaveLength(7);
    await fireEvent.press(screen.getByText('Show 10 days'));
    expect(screen.getAllByTestId('range-bar')).toHaveLength(10);
    expect(screen.getAllByTestId('range-bar-marker')).toHaveLength(1);
  });

  it('shows the clothing advice and the Demo data badge for mock meta', async () => {
    await renderToday();
    expect(screen.getByText('Light jacket, long sleeves')).toBeTruthy();
    expect(screen.getByTestId('demo-badge')).toBeTruthy();
  });
});
