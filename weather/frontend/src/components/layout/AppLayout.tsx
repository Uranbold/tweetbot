import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { SkeletonCard } from '../common/Skeleton';

export function AppLayout() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="main" tabIndex={-1}>
        <Suspense fallback={<SkeletonCard lines={4} height={320} />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
