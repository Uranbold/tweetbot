import type { AlertType } from '@contract';

export const HAZARD_LABELS: Record<AlertType, string> = {
  'heat-wave': 'Heat wave',
  'cold-wave': 'Cold wave',
  'heavy-rain': 'Heavy rain',
  'heavy-snow': 'Heavy snow',
  'strong-wind': 'Strong wind',
  dry: 'Dry conditions',
  'fine-dust': 'Fine dust',
  typhoon: 'Typhoon',
};
