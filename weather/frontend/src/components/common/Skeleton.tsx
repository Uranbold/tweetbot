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
