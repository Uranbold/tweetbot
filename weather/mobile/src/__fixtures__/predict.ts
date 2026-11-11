import type { AiPrediction, PredictedDaily, PredictedHourly } from '@contract';
import { ulaanbaatar } from './weather';

const pad = (n: number) => String(n).padStart(2, '0');

function hourly(): PredictedHourly[] {
  const out: PredictedHourly[] = [];
  for (let i = 0; i < 72; i++) {
    const abs = 14 + i;
    const h = abs % 24;
    const dayOffset = Math.floor(abs / 24);
    const date = `2026-10-${pad(1 + dayOffset)}`;
    const nwp = 6 + 8 * Math.sin(((h - 5) / 24) * Math.PI * 2) - dayOffset * 2.5;
    const ai = nwp - 1.4 + 0.6 * Math.sin(i / 7);
    const spread = 1.5 + i / 36;
    out.push({
      time: `${date}T${pad(h)}:00`,
      temperature: Math.round(ai * 10) / 10,
      temperatureNwp: Math.round(nwp * 10) / 10,
      temperatureP10: Math.round((ai - spread) * 10) / 10,
      temperatureP90: Math.round((ai + spread) * 10) / 10,
      precipitationProbability: i > 24 && i < 40 ? 65 : 10,
      precipitation: i > 24 && i < 40 ? 0.8 : 0,
    });
  }
  return out;
}

const daily: PredictedDaily[] = [
  {
    date: '2026-10-01',
    temperatureMin: -2.1,
    temperatureMax: 12.8,
    temperatureMinP10: -4,
    temperatureMaxP90: 14.5,
    precipitationSum: 1.1,
    hazardProbabilities: { 'heavy-rain': 0.22 },
  },
  {
    date: '2026-10-02',
    temperatureMin: -4.6,
    temperatureMax: 9.4,
    temperatureMinP10: -6.5,
    temperatureMaxP90: 11,
    precipitationSum: 5.2,
    hazardProbabilities: { 'heavy-snow': 0.48, 'strong-wind': 0.31 },
  },
  {
    date: '2026-10-03',
    temperatureMin: -11.3,
    temperatureMax: 2.1,
    temperatureMinP10: -14,
    temperatureMaxP90: 4,
    precipitationSum: 0.4,
    hazardProbabilities: { 'cold-wave': 0.81, 'heavy-snow': 0.35 },
  },
];

export const predictFixture: AiPrediction = {
  location: ulaanbaatar,
  generatedAt: '2026-10-01T05:50:00Z',
  horizonHours: 72,
  hourly: hourly(),
  daily,
  risks: [
    {
      hazard: 'cold-wave',
      severity: 'warning',
      probability: 0.81,
      expectedStart: '2026-10-03T03:00',
      rationale: 'Ensemble spread narrow; 6/7 models below -10 °C Saturday morning',
    },
    {
      hazard: 'heavy-snow',
      severity: 'advisory',
      probability: 0.48,
      expectedStart: '2026-10-02T18:00',
      rationale: 'ICON and GFS show 5–8 cm overnight; ECMWF drier',
    },
    {
      hazard: 'strong-wind',
      severity: 'advisory',
      probability: 0.31,
      rationale: 'Gusts 14–16 m/s possible behind the front',
    },
  ],
  summary:
    'Temperatures fall sharply from Friday night: a cold wave is likely by Saturday morning (81%), with a moderate chance of heavy snow Friday evening. AI correction runs 1.4° colder than the raw model.',
  model: {
    name: 'skycast-gbr-v1',
    version: '1.0.3',
    algorithm: 'gradient-boosting',
    trainedAt: '2026-09-30T02:00:00Z',
    trainingSamples: 18_240,
    metrics: { temperatureMae: 1.2, temperatureMaeNwp: 1.9, precipitationBrier: 0.14 },
    features: ['nwp_temp', 'hour_sin', 'hour_cos', 'doy', 'residual_24h', 'residual_7d', 'elevation', 'ensemble_spread'],
  },
};
