/** Thermal comfort formulas (°C, m/s, %). */

/** Environment Canada / NWS wind chill; valid for T ≤ 10 °C and wind > 1.3 m/s (4.8 km/h). */
export function windChill(tempC: number, windMs: number): number {
  const v = Math.pow(windMs * 3.6, 0.16);
  return 13.12 + 0.6215 * tempC - 11.37 * v + 0.3965 * tempC * v;
}

export const windChillApplies = (tempC: number, windMs: number) => tempC <= 10 && windMs > 1.3;

/** NWS heat index (Rothfusz regression with Steadman fallback); meaningful for T ≥ 27 °C. */
export function heatIndex(tempC: number, rh: number): number {
  const t = (tempC * 9) / 5 + 32;
  const simple = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  let hi = simple;
  if ((simple + t) / 2 >= 80) {
    hi = -42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh - 0.00683783 * t * t - 0.05481717 * rh * rh +
      0.00122874 * t * t * rh + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh;
    if (rh < 13 && t >= 80 && t <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
    else if (rh > 85 && t >= 80 && t <= 87) hi += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return ((hi - 32) * 5) / 9;
}

export const heatIndexApplies = (tempC: number) => tempC >= 27;

/** Simple apparent temperature used by the mock provider. */
export function apparentTemperature(tempC: number, rh: number, windMs: number): number {
  if (windChillApplies(tempC, windMs)) return windChill(tempC, windMs);
  if (heatIndexApplies(tempC)) return heatIndex(tempC, rh);
  return tempC - 0.3 * Math.max(0, windMs - 1);
}
