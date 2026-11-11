export type RegionId = 'mn' | 'kr' | 'world';

export const REGIONS: { value: RegionId; label: string }[] = [
  { value: 'mn', label: 'Mongolia' },
  { value: 'kr', label: 'Korea' },
  { value: 'world', label: 'World' },
];

export function isRegion(v: string | null | undefined): v is RegionId {
  return v === 'mn' || v === 'kr' || v === 'world';
}

export const REGION_VIEW: Record<RegionId, { center: [number, number]; zoom: number }> = {
  mn: { center: [46.8, 103.5], zoom: 5 },
  kr: { center: [36.2, 127.8], zoom: 7 },
  world: { center: [30, 60], zoom: 2 },
};
