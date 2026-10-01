import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { Providers } from '../Providers';

export function testQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
}

export function renderWithProviders(ui: ReactElement, { route = '/', client = testQueryClient() }: { route?: string; client?: QueryClient } = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Providers client={client}>{children}</Providers>
    </MemoryRouter>
  );
  return { client, ...render(ui, { wrapper }) };
}
