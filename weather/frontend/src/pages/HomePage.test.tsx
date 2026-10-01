import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import HomePage from './HomePage';
import { renderWithProviders } from '../test/utils';
import { createFixtureFetch } from '../__fixtures__/handler';
import { FAVORITES_KEY } from '../hooks/useFavorites';

const fixtureFetch = createFixtureFetch();

function renderHome(route = '/') {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>,
    { route },
  );
}

describe('HomePage', () => {
  it('renders every card from the /weather response', async () => {
    vi.stubGlobal('fetch', vi.fn(fixtureFetch));
    renderHome();
    expect(screen.getByRole('status', { name: 'Loading current weather' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ulaanbaatar' })).toBeInTheDocument();
    for (const title of ['Hourly forecast', 'AI forecast', 'Life & health indices', "Today's outfit", '10-day forecast', 'Air quality', 'Sunrise & sunset', 'Nationwide weather']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('Strong wind advisory')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Darkhan/ })).toBeInTheDocument();
  });

  it('keeps working when the AI service returns 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/predict')) {
          return new Response(JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'down' } }), { status: 503 });
        }
        return fixtureFetch(input);
      }),
    );
    renderHome('/?lat=37.57&lon=126.98&name=Seoul');
    expect(await screen.findByRole('heading', { level: 1, name: 'Seoul' })).toBeInTheDocument();
    expect(await screen.findByText('AI forecast unavailable')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '10-day forecast' })).toBeInTheDocument();
  });

  it('shows an error with retry when /weather fails', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'INTERNAL', message: 'boom' } }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    renderHome();
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    fetchMock.mockImplementation(fixtureFetch as never);
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ulaanbaatar' })).toBeInTheDocument();
  });

  it('stars the current location into favourites', async () => {
    vi.stubGlobal('fetch', vi.fn(fixtureFetch));
    renderHome();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Ulaanbaatar to favorites' }));
    expect(JSON.parse(window.localStorage.getItem(FAVORITES_KEY)!)[0]).toMatchObject({ name: 'Ulaanbaatar', lat: 47.92, lon: 106.92 });
  });
});
