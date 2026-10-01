import type { ReactElement } from 'react';
import type { Condition, ConditionKey } from '@contract';

/*
 * Small inline SVG weather icon set (64×64 grid), keyed by ConditionKey with day/night variants.
 * Colours come from CSS custom properties (--icon-*) so the set adapts to the dark theme.
 */

const SUN = 'var(--icon-sun)';
const MOON = 'var(--icon-moon)';
const CLOUD = 'var(--icon-cloud)';
const CLOUD_DARK = 'var(--icon-cloud-dark)';
const RAIN = 'var(--icon-rain)';
const SNOW = 'var(--icon-snow)';
const BOLT = 'var(--icon-bolt)';
const FOG = 'var(--icon-fog)';

const CLOUD_PATH = 'M18 48h28a10 10 0 0 0 1.5-19.9A14 14 0 0 0 20.6 25 11.5 11.5 0 0 0 18 48z';

function Sun({ cx = 32, cy = 32, r = 11 }: { cx?: number; cy?: number; r?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const r1 = r + 4;
    const r2 = r + 9;
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * r1}
        y1={cy + Math.sin(a) * r1}
        x2={cx + Math.cos(a) * r2}
        y2={cy + Math.sin(a) * r2}
        stroke={SUN}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
    );
  });
  return (
    <g>
      {rays}
      <circle cx={cx} cy={cy} r={r} fill={SUN} />
    </g>
  );
}

function Moon({ cx = 32, cy = 32, r = 14 }: { cx?: number; cy?: number; r?: number }) {
  // Crescent: outer arc the long way round the left, inner (concave) arc back.
  const pt = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)].map((v) => v.toFixed(2));
  const [ax, ay] = pt(-70);
  const [bx, by] = pt(20);
  const d = `M${ax} ${ay}A${r} ${r} 0 1 0 ${bx} ${by}A${(r * 0.82).toFixed(2)} ${(r * 0.82).toFixed(2)} 0 0 1 ${ax} ${ay}z`;
  return <path d={d} fill={MOON} />;
}

function Cloud({ x = 0, y = 0, s = 1, dark = false }: { x?: number; y?: number; s?: number; dark?: boolean }) {
  return (
    <path
      d={CLOUD_PATH}
      transform={`translate(${x} ${y}) scale(${s})`}
      fill={dark ? CLOUD_DARK : CLOUD}
      stroke="var(--icon-outline)"
      strokeWidth={1.5 / s}
      strokeLinejoin="round"
    />
  );
}

function Drops({ n, heavy = false }: { n: number; heavy?: boolean }) {
  const xs = n === 2 ? [26, 38] : n === 3 ? [22, 32, 42] : [19, 27, 35, 43];
  return (
    <g stroke={RAIN} strokeWidth={heavy ? 3.4 : 3} strokeLinecap="round">
      {xs.map((x, i) => (
        <line key={x} x1={x} y1={50 + (i % 2) * 2} x2={x - 3} y2={(heavy ? 60 : 57) + (i % 2) * 2} />
      ))}
    </g>
  );
}

function Flake({ x, y, r = 3.4 }: { x: number; y: number; r?: number }) {
  return (
    <g stroke={SNOW} strokeWidth={2} strokeLinecap="round">
      <line x1={x - r} y1={y} x2={x + r} y2={y} />
      <line x1={x - r / 2} y1={y - r * 0.87} x2={x + r / 2} y2={y + r * 0.87} />
      <line x1={x - r / 2} y1={y + r * 0.87} x2={x + r / 2} y2={y - r * 0.87} />
    </g>
  );
}

function Bolt() {
  return <path d="M34 44l-7 10h6l-3 9 10-13h-6l4-6z" fill={BOLT} stroke="var(--icon-outline)" strokeWidth={1} strokeLinejoin="round" />;
}

function FogLines() {
  return (
    <g stroke={FOG} strokeWidth={3.2} strokeLinecap="round">
      <line x1={12} y1={30} x2={52} y2={30} />
      <line x1={16} y1={39} x2={48} y2={39} />
      <line x1={10} y1={48} x2={44} y2={48} />
      <line x1={20} y1={21} x2={44} y2={21} />
    </g>
  );
}

/** Sun or moon peeking out behind a cloud. */
const Peek = ({ isDay }: { isDay: boolean }) => (isDay ? <Sun cx={24} cy={22} r={8} /> : <Moon cx={24} cy={22} r={10} />);

const BUILDERS: Record<ConditionKey, (isDay: boolean) => ReactElement> = {
  clear: (isDay) => (isDay ? <Sun /> : <Moon />),
  'mostly-clear': (isDay) => (
    <>
      {isDay ? <Sun cx={28} cy={28} r={10} /> : <Moon cx={28} cy={28} r={13} />}
      <Cloud x={20} y={22} s={0.6} />
    </>
  ),
  'partly-cloudy': (isDay) => (
    <>
      <Peek isDay={isDay} />
      <Cloud x={2} y={4} s={0.98} />
    </>
  ),
  cloudy: () => (
    <>
      <Cloud x={10} y={-6} s={0.75} dark />
      <Cloud x={-2} y={2} s={1.02} />
    </>
  ),
  fog: () => <FogLines />,
  drizzle: () => (
    <>
      <Cloud y={-6} />
      <Drops n={2} />
    </>
  ),
  rain: () => (
    <>
      <Cloud y={-6} />
      <Drops n={3} />
    </>
  ),
  'heavy-rain': () => (
    <>
      <Cloud y={-6} dark />
      <Drops n={4} heavy />
    </>
  ),
  'freezing-rain': () => (
    <>
      <Cloud y={-6} />
      <g stroke={RAIN} strokeWidth={3} strokeLinecap="round">
        <line x1={24} y1={50} x2={21} y2={57} />
        <line x1={40} y1={50} x2={37} y2={57} />
      </g>
      <Flake x={31} y={56} />
    </>
  ),
  snow: () => (
    <>
      <Cloud y={-6} />
      <Flake x={23} y={53} />
      <Flake x={40} y={55} />
    </>
  ),
  'heavy-snow': () => (
    <>
      <Cloud y={-6} dark />
      <Flake x={19} y={53} />
      <Flake x={31} y={57} />
      <Flake x={43} y={53} />
    </>
  ),
  sleet: () => (
    <>
      <Cloud y={-6} />
      <g stroke={RAIN} strokeWidth={3} strokeLinecap="round">
        <line x1={24} y1={50} x2={21} y2={58} />
      </g>
      <Flake x={39} y={54} />
    </>
  ),
  thunderstorm: () => (
    <>
      <Cloud y={-8} dark />
      <Bolt />
      <g stroke={RAIN} strokeWidth={3} strokeLinecap="round">
        <line x1={22} y1={48} x2={19} y2={55} />
        <line x1={45} y1={48} x2={42} y2={55} />
      </g>
    </>
  ),
};

export interface WeatherIconProps {
  condition?: Pick<Condition, 'key' | 'isDay' | 'label'>;
  conditionKey?: ConditionKey;
  isDay?: boolean;
  size?: number;
  /** Accessible label; defaults to the condition label. Pass "" to mark decorative. */
  label?: string;
  className?: string;
}

export function WeatherIcon({ condition, conditionKey, isDay, size = 40, label, className }: WeatherIconProps) {
  const key: ConditionKey = condition?.key ?? conditionKey ?? 'cloudy';
  const day = isDay ?? condition?.isDay ?? true;
  const name = label ?? condition?.label ?? key.replace('-', ' ');
  const build = BUILDERS[key] ?? BUILDERS.cloudy;
  const decorative = name === '';
  return (
    <svg
      className={['wx-icon', className].filter(Boolean).join(' ')}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-condition={key}
      data-day={day ? 'day' : 'night'}
    >
      {build(day)}
    </svg>
  );
}

export const CONDITION_KEYS = Object.keys(BUILDERS) as ConditionKey[];
