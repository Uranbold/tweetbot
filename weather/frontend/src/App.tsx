import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import HomePage from './pages/HomePage';

const AirPage = lazy(() => import('./pages/AirPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="air" element={<AirPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
