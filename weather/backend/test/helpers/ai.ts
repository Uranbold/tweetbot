import type { AiPrediction, ApiResponse, HazardRisk } from '../../src/types.js';
import type { AiPredictionProvider } from '../../src/services/predictService.js';
import { UpstreamError } from '../../src/errors.js';

export function aiBody(risks: HazardRisk[] = []): ApiResponse<AiPrediction> {
  return {
    data: {
      location: { id: '2028462', name: 'Ulaanbaatar', country: 'Mongolia', countryCode: 'MN', lat: 47.9, lon: 106.9, timezone: 'Asia/Ulaanbaatar', utcOffsetSeconds: 28800 },
      generatedAt: '2026-10-01T14:00:00Z',
      horizonHours: 72,
      hourly: [{ time: '2026-10-01T22:00', temperature: 1.2, temperatureNwp: 1.4, temperatureP10: 0, temperatureP90: 2.5, precipitationProbability: 5, precipitation: 0 }],
      daily: [],
      risks,
      summary: 'Cold nights ahead.',
      model: { name: 'skycast-gbr-v1', version: '1.0.0', algorithm: 'gradient-boosting', trainedAt: '2026-09-30T00:00:00Z', trainingSamples: 1000, metrics: {}, features: ['nwp_temp'] },
    },
    meta: { provider: 'skycast-ai', fetchedAt: '2026-10-01T14:00:00Z', stale: false, mock: false },
  };
}

/** Controllable fake AI service. */
export function fakeAi(risks: HazardRisk[] = []) {
  const state = { up: true, calls: 0, risks };
  const provider: AiPredictionProvider = {
    async predict() {
      state.calls++;
      if (!state.up) throw new UpstreamError('ai-service', 'network', 'connect ECONNREFUSED 127.0.0.1:8790');
      return aiBody(state.risks);
    },
  };
  return { provider, state };
}
