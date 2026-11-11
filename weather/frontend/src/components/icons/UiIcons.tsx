import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number; label?: string };

function Base({ size = 20, label, children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Base>
);

export const LocateIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Base>
);

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
  </Base>
);

export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Base>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 6l6 6-6 6" />
  </Base>
);

export const ClockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Base>
);

export const PinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Base>
);

export const WarningIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5L2.5 20h19z" />
    <path d="M12 10v4.5M12 17.3v.2" />
  </Base>
);

export const RefreshIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.6L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.6L20 16M20 20v-4h-4" />
  </Base>
);

export const DropIcon = (p: IconProps) => (
  <Base {...p} strokeWidth={0} fill="currentColor">
    <path d="M12 3c3.5 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.4 6-11z" />
  </Base>
);

export const ShirtIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M8 3.5L3 6.5l2 4 2-1V20h10V9.5l2 1 2-4-5-3c-.5 1.6-2 2.7-4 2.7S8.5 5.1 8 3.5z" />
  </Base>
);

/** Arrow pointing up; rotate with `rotation` degrees (clockwise). */
export const ArrowIcon = ({ rotation = 0, ...p }: IconProps & { rotation?: number }) => (
  <Base {...p} style={{ transform: `rotate(${rotation}deg)`, ...(p.style ?? {}) }}>
    <path d="M12 20V4M6 10l6-6 6 6" />
  </Base>
);
