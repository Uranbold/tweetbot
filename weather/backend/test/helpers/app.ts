import type { FastifyInstance } from 'fastify';
import { loadConfig, type Config } from '../../src/config.js';
import { createContainer, type Container, type Overrides } from '../../src/container.js';
import { UpstreamError } from '../../src/errors.js';
import { buildApp } from '../../src/http/app.js';
import type { AirQualityProvider, GeocodingProvider, ModelComparisonProvider, WeatherProvider } from '../../src/providers/ports.js';

export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({ PROVIDER_MODE: 'mock', DISPATCH_ENABLED: 'false', LOG_LEVEL: 'silent', RATE_LIMIT_MAX: '10000', ...env });
}

export async function makeApp(env: Record<string, string> = {}, overrides: Overrides = {}): Promise<{ app: FastifyInstance; container: Container }> {
  const container = createContainer(testConfig(env), overrides);
  const app = await buildApp(container, { logger: false });
  await app.ready();
  return { app, container };
}

export const rateLimited = () => new UpstreamError('open-meteo forecast', 'rate-limited', 'HTTP 429 — Daily API request limit exceeded', 429);

/** Live adapters that always fail like the quota-exhausted Open-Meteo forecast API. */
export function failingProviders(err: () => Error = rateLimited) {
  const fail = async (): Promise<never> => {
    throw err();
  };
  const weather: WeatherProvider = { name: 'open-meteo', getForecast: fail, getSnapshots: fail };
  const air: AirQualityProvider = { name: 'open-meteo', getAirQuality: fail, getCurrentBatch: fail };
  const geocoding: GeocodingProvider = { name: 'open-meteo', search: fail, reverse: fail };
  const models: ModelComparisonProvider = { name: 'open-meteo', getModels: fail };
  return { weather, air, geocoding, models };
}
