import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiForecastCard } from './AiForecastCard';
import { renderWithProviders } from '../../test/utils';
import { createFixtureFetch } from '../../__fixtures__/handler';

const unavailable = () =>
  new Response(JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'AI service down' } }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

describe('AiForecastCard', () => {
  it('renders summary, up to 3 risks with severity bars, band chart and model footer', async () => {
    vi.stubGlobal('fetch', vi.fn(createFixtureFetch()));
    renderWithProviders(<AiForecastCard lat={47.92} lon={106.92} today="2026-10-01" />);
    expect(await screen.findByText(/72% chance of strong-wind/)).toBeInTheDocument();
    const risks = screen.getAllByTestId('ai-risk');
    expect(risks).toHaveLength(3);
    expect(risks[0]).toHaveClass('ai-risk--advisory');
    expect(within(risks[0]).getByRole('meter', { name: 'Strong wind probability' })).toHaveAttribute('aria-valuenow', '72');
    expect(risks[2]).toHaveClass('ai-risk--warning');
    expect(screen.getByTestId('ai-band')).toBeInTheDocument();
    expect(screen.getByTestId('ai-nwp')).toBeInTheDocument();
    expect(screen.getByTestId('ai-line').getAttribute('points')!.split(' ')).toHaveLength(72);
    expect(screen.getByTestId('ai-footer')).toHaveTextContent('skycast-gbr-v1 · MAE 1.2° vs 1.9° raw · 18,432 samples');
  });

  it('shows a quiet unavailable state on 503 and retries on demand', async () => {
    const fetchMock = vi.fn(async () => unavailable());
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<AiForecastCard lat={47.92} lon={106.92} today="2026-10-01" />);
    expect(await screen.findByText('AI forecast unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockImplementation(createFixtureFetch() as never);
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findAllByTestId('ai-risk')).toHaveLength(3);
  });
});
