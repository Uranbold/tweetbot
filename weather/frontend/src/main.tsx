import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Providers } from './Providers';
import { AppRoutes } from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Providers>
        <AppRoutes />
      </Providers>
    </BrowserRouter>
  </StrictMode>,
);
