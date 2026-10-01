import { useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createQueryClient } from './api/hooks';
import { SavedPlacesProvider } from './hooks/useFavorites';

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [qc] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={qc}>
      <SavedPlacesProvider>{children}</SavedPlacesProvider>
    </QueryClientProvider>
  );
}
