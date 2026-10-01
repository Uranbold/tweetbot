import type { ModelId } from '@contract';

export interface ModelMeta {
  id: ModelId;
  label: string;
  agency: string;
  /** Fixed categorical colour (CSS custom property) — colour follows the model, never its rank. */
  color: string;
}

export const MODELS: ModelMeta[] = [
  { id: 'ecmwf', label: 'ECMWF IFS', agency: 'European Centre', color: 'var(--series-1)' },
  { id: 'gfs', label: 'NOAA GFS', agency: 'United States', color: 'var(--series-2)' },
  { id: 'icon', label: 'DWD ICON', agency: 'Germany', color: 'var(--series-3)' },
  { id: 'jma', label: 'JMA GSM', agency: 'Japan', color: 'var(--series-4)' },
  { id: 'kma', label: 'KMA', agency: 'Korea', color: 'var(--series-5)' },
  { id: 'gem', label: 'CMC GEM', agency: 'Canada', color: 'var(--series-6)' },
  { id: 'meteofrance', label: 'Météo-France', agency: 'France', color: 'var(--series-7)' },
];

/** Hick's law: 3 pre-selected models; the rest sit behind "More models". */
export const DEFAULT_MODELS: ModelId[] = ['ecmwf', 'gfs', 'icon'];
export const PRIMARY_MODELS: ModelId[] = ['ecmwf', 'gfs', 'icon'];

const IDS = new Set<string>(MODELS.map((m) => m.id));

export function parseModels(raw: string | null): ModelId[] {
  if (raw == null) return DEFAULT_MODELS;
  const list = raw.split(',').filter((s): s is ModelId => IDS.has(s));
  // Keep canonical order so colours and columns are stable.
  return MODELS.map((m) => m.id).filter((id) => list.includes(id));
}

export const modelInfo = (id: ModelId): ModelMeta => MODELS.find((m) => m.id === id) ?? MODELS[0];
