import type { CSSProperties } from 'react';

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

/** A card-shaped placeholder with a few lines. */
export function SkeletonCard({ lines = 3, height = 160, label = 'Loading' }: { lines?: number; height?: number; label?: string }) {
  return (
    <div className="card skeleton-card" role="status" aria-label={label} style={{ minHeight: height }}>
      <Skeleton width="40%" height={20} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${90 - i * 12}%`} height={14} />
      ))}
    </div>
  );
}

/* Skeletons with the same geometry as the loaded cards (UX §2 Doherty / §4.1 states). */

export function CurrentSkeleton() {
  return (
    <div className="card skeleton-card current" role="status" aria-label="Loading current weather">
      <Skeleton width="45%" height={24} />
      <Skeleton width="30%" height={13} />
      <div className="skeleton-row">
        <Skeleton width={150} height={72} radius={12} />
        <Skeleton width={96} height={64} radius={12} />
      </div>
      <Skeleton width="55%" height={15} />
      <Skeleton height={58} radius={12} />
      <div className="skeleton-row">
        {[96, 104, 92, 92].map((w, i) => (
          <Skeleton key={i} width={w} height={30} radius={999} />
        ))}
      </div>
      <Skeleton width="80%" height={17} />
    </div>
  );
}

export function TitledSkeleton({ title, height, rows = 0, label }: { title: string; height: number; rows?: number; label?: string }) {
  return (
    <div className="card skeleton-card" role="status" aria-label={label ?? `Loading ${title.toLowerCase()}`} style={{ minHeight: height }}>
      <span className="card__title skeleton-title" aria-hidden="true">
        {title}
      </span>
      {rows > 0 ? Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={36} radius={8} />) : <Skeleton height={height - 80} radius={12} />}
    </div>
  );
}
