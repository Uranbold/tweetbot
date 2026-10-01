import type { ClothingAdvice } from '../types.js';

interface Band {
  min: number; // inclusive lower bound (rounded °C)
  summary: string;
  items: string[];
}

/** BR-04: Naver 옷차림 temperature bands, warmest first. */
export const CLOTHING_BANDS: readonly Band[] = [
  { min: 28, summary: 'Sleeveless top, shorts', items: ['Sleeveless top', 'Shorts', 'Linen dress'] },
  { min: 23, summary: 'Short sleeves, thin shirt', items: ['Short sleeves', 'Thin shirt', 'Cotton trousers'] },
  { min: 20, summary: 'Thin long sleeves, cotton trousers', items: ['Thin long sleeves', 'Blouse', 'Cotton trousers'] },
  { min: 17, summary: 'Light knit or hoodie', items: ['Light knit', 'Hoodie', 'Jeans'] },
  { min: 12, summary: 'Jacket or cardigan', items: ['Jacket', 'Cardigan', 'Jeans'] },
  { min: 9, summary: 'Trench coat, layered', items: ['Trench coat', 'Field jacket', 'Layered knit'] },
  { min: 5, summary: 'Wool coat, warm layers', items: ['Wool coat', 'Heat-tech', 'Knit'] },
  { min: -Infinity, summary: 'Padded coat, scarf', items: ['Padded coat', 'Scarf', 'Gloves', 'Hat'] },
];

export function clothingBand(tempC: number): Band {
  const t = Math.round(tempC);
  return CLOTHING_BANDS.find((b) => t >= b.min)!;
}

export function clothingAdvice(tempC: number, opts: { precipitationProbability?: number } = {}): ClothingAdvice {
  const band = clothingBand(tempC);
  const items = [...band.items];
  let summary = band.summary;
  if ((opts.precipitationProbability ?? 0) >= 60) {
    items.push('Umbrella');
    summary += ', umbrella';
  }
  return { summary, items };
}
