import type { ModelId } from '../types.js';

export interface ModelMeta {
  id: ModelId;
  label: string;
  agency: string;
  /** Open-Meteo `models=` identifier; response keys are suffixed with it. */
  openMeteo: string;
}

export const MODELS: Record<ModelId, ModelMeta> = {
  ecmwf: { id: 'ecmwf', label: 'ECMWF IFS', agency: 'European Centre (EU)', openMeteo: 'ecmwf_ifs025' },
  gfs: { id: 'gfs', label: 'NOAA GFS', agency: 'NOAA (US)', openMeteo: 'gfs_seamless' },
  icon: { id: 'icon', label: 'DWD ICON', agency: 'Deutscher Wetterdienst (DE)', openMeteo: 'icon_seamless' },
  jma: { id: 'jma', label: 'JMA GSM', agency: 'Japan Meteorological Agency (JP)', openMeteo: 'jma_seamless' },
  kma: { id: 'kma', label: 'KMA GDPS', agency: 'Korea Meteorological Administration (KR)', openMeteo: 'kma_seamless' },
  gem: { id: 'gem', label: 'CMC GEM', agency: 'Environment and Climate Change Canada (CA)', openMeteo: 'gem_seamless' },
  meteofrance: { id: 'meteofrance', label: 'Météo-France ARPEGE', agency: 'Météo-France (FR)', openMeteo: 'meteofrance_seamless' },
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];
