import { describe, expect, it } from 'vitest';
import { clothingAdvice, clothingBand } from '../../src/domain/clothing.js';

describe('BR-04 clothing bands', () => {
  it.each([
    [35, 'Sleeveless top'], [28, 'Sleeveless top'], [27, 'Short sleeves'], [23, 'Short sleeves'],
    [22, 'Thin long sleeves'], [20, 'Thin long sleeves'], [19, 'Light knit'], [17, 'Light knit'],
    [16, 'Jacket'], [12, 'Jacket'], [11, 'Trench coat'], [9, 'Trench coat'], [8, 'Wool coat'], [5, 'Wool coat'],
    [4, 'Padded coat'], [-25, 'Padded coat'],
  ])('%d°C → %s', (t, item) => {
    expect(clothingBand(t).items[0]).toBe(item);
  });

  it('rounds to the nearest degree before banding', () => {
    expect(clothingBand(27.6).items[0]).toBe('Sleeveless top');
    expect(clothingBand(27.4).items[0]).toBe('Short sleeves');
    expect(clothingBand(4.4).items[0]).toBe('Padded coat');
  });

  it('includes scarf for the coldest band and adds an umbrella when rain is likely', () => {
    expect(clothingAdvice(0).items).toContain('Scarf');
    const wet = clothingAdvice(15, { precipitationProbability: 70 });
    expect(wet.items).toContain('Umbrella');
    expect(wet.summary).toBe('Jacket or cardigan, umbrella');
    expect(clothingAdvice(15, { precipitationProbability: 30 }).items).not.toContain('Umbrella');
  });
});
