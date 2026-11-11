/**
 * Hand-written OpenAPI 3.1 description of /api/v1. The TypeScript contract
 * (shared/contract.ts) remains the source of truth; payload schemas below name the
 * contract type they mirror and spell out the commonly used parts.
 */
import { MODEL_IDS } from '../domain/models.js';
import { ALERT_TYPES } from './schemas.js';

type Json = Record<string, unknown>;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const q = (name: string, schema: Json, required = false, description?: string) => ({ name, in: 'query', required, schema, ...(description ? { description } : {}) });
const latLon = [
  q('lat', { type: 'number', minimum: -90, maximum: 90 }, true),
  q('lon', { type: 'number', minimum: -180, maximum: 180 }, true),
];
const idPath = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const envelopeOf = (data: Json) => ({
  type: 'object',
  required: ['data', 'meta'],
  properties: { data, meta: ref('ApiMeta') },
});
const ok = (data: Json, description = 'OK', cached = true) => ({
  description,
  ...(cached ? { headers: { 'X-Cache': { schema: { type: 'string', enum: ['HIT', 'MISS', 'STALE'] } }, 'Cache-Control': { schema: { type: 'string' } } } } : {}),
  content: { 'application/json': { schema: envelopeOf(data) } },
});
const err = (description: string) => ({ description, content: { 'application/json': { schema: ref('ApiError') } } });
const errors = { '400': err('Invalid parameters (BAD_REQUEST)'), '429': err('Rate limited (RATE_LIMITED)'), '503': err('Upstream unavailable (UPSTREAM_UNAVAILABLE)') };
const contractType = (name: string, extra: Json = {}) => ({ type: 'object', description: `See \`${name}\` in shared/contract.ts.`, ...extra });
const jsonBody = (schema: Json) => ({ required: true, content: { 'application/json': { schema } } });

export function buildOpenApi(): Json {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Skycast API',
      version: '1.0.0',
      description: 'Weather BFF modelled on weather.naver.com. Data: Open-Meteo (CC BY 4.0), with a deterministic mock fallback flagged by meta.mock.',
    },
    servers: [{ url: '/api/v1' }],
    paths: {
      '/health': { get: { summary: 'Liveness, provider mode, cache, upstream and dispatcher stats', responses: { '200': { description: 'OK', content: { 'application/json': { schema: ref('Health') } } } } } },
      '/locations/search': {
        get: {
          summary: 'Autocomplete place search',
          parameters: [q('q', { type: 'string', minLength: 1, maxLength: 100 }, true), q('limit', { type: 'integer', minimum: 1, maximum: 20, default: 8 })],
          responses: { '200': ok({ type: 'array', items: ref('Location') }), ...errors },
        },
      },
      '/locations/reverse': { get: { summary: 'Coordinates → nearest known place (or ad-hoc "lat,lon")', parameters: latLon, responses: { '200': ok(ref('Location')), ...errors } } },
      '/weather': { get: { summary: 'Home aggregate: current, 48 h hourly, 10-day daily, air, life indices, alerts, clothing', parameters: latLon, responses: { '200': ok(ref('TodayWeather')), ...errors } } },
      '/air': { get: { summary: 'Air-quality report (72 h, 4-day grades, grade scale)', parameters: latLon, responses: { '200': ok(ref('AirQualityReport')), ...errors } } },
      '/compare': {
        get: {
          summary: 'Multi-model forecast comparison with consensus/agreement',
          parameters: [...latLon, q('models', { type: 'string', example: 'ecmwf,gfs' }, false, `Comma-separated subset of ${MODEL_IDS.join(', ')}; default all`)],
          responses: { '200': ok(ref('ForecastComparison')), ...errors },
        },
      },
      '/nation': {
        get: {
          summary: 'City snapshots for a region group (one batched upstream call)',
          parameters: [q('region', { type: 'string', enum: ['mn', 'kr', 'world'], default: 'mn' })],
          responses: { '200': ok(ref('NationSnapshot')), ...errors },
        },
      },
      '/regions': { get: { summary: 'Notification regions (one per catalogue city)', responses: { '200': ok({ type: 'array', items: ref('Region') }, 'OK', false) } } },
      '/regions/{id}/alerts': {
        get: {
          summary: 'Derived alerts, AI risks (best effort) and air snapshot for a region',
          parameters: [idPath],
          responses: {
            '200': ok({ type: 'object', properties: { alerts: { type: 'array', items: ref('WeatherAlert') }, risks: { type: 'array', items: contractType('HazardRisk') }, air: { oneOf: [contractType('AirQualitySnapshot'), { type: 'null' }] } } }),
            '404': err('Unknown region (NOT_FOUND)'),
            ...errors,
          },
        },
      },
      '/predict': {
        get: {
          summary: 'AI post-processed forecast (proxied from the AI service, cached 30 min, never mocked)',
          parameters: [...latLon, q('hours', { type: 'integer', minimum: 1, maximum: 240, default: 72 })],
          responses: { '200': ok(contractType('AiPrediction')), ...errors },
        },
      },
      '/devices': {
        post: {
          summary: 'Register a device (upsert by pushToken)',
          requestBody: jsonBody(ref('DeviceRegistration')),
          responses: { '201': ok(ref('Device'), 'Created', false), '200': ok(ref('Device'), 'Updated existing device with this pushToken', false), '400': err('Invalid body') },
        },
      },
      '/devices/{id}': {
        get: { summary: 'Get a device', parameters: [idPath], responses: { '200': ok(ref('Device'), 'OK', false), '404': err('Not found') } },
        patch: {
          summary: 'Partially update a device (preferences merged field by field)',
          parameters: [idPath],
          requestBody: jsonBody({ type: 'object', description: 'Partial<DeviceRegistration>; preferences may be partial' }),
          responses: { '200': ok(ref('Device'), 'OK', false), '400': err('Invalid body'), '404': err('Not found') },
        },
        delete: { summary: 'Unregister a device', parameters: [idPath], responses: { '204': { description: 'Deleted' }, '404': err('Not found') } },
      },
      '/devices/{id}/notifications': {
        get: { summary: 'Last 50 notifications sent to the device', parameters: [idPath], responses: { '200': ok({ type: 'array', items: ref('NotificationMessage') }, 'OK', false), '404': err('Not found') } },
      },
      '/devices/{id}/test-notification': {
        post: { summary: 'Send a test push to the device', parameters: [idPath], responses: { '200': ok(ref('NotificationMessage'), 'OK', false), '404': err('Not found') } },
      },
      '/openapi.json': { get: { summary: 'This document', responses: { '200': { description: 'OpenAPI 3.1 JSON' } } } },
    },
    components: {
      schemas: {
        ApiMeta: {
          type: 'object',
          required: ['provider', 'fetchedAt', 'stale', 'mock'],
          properties: {
            provider: { type: 'string', example: 'open-meteo' },
            fetchedAt: { type: 'string', format: 'date-time' },
            stale: { type: 'boolean', description: 'Served from cache after an upstream failure' },
            mock: { type: 'boolean', description: 'Produced by the deterministic mock provider' },
          },
        },
        ApiError: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: { code: { type: 'string', enum: ['BAD_REQUEST', 'NOT_FOUND', 'UPSTREAM_UNAVAILABLE', 'RATE_LIMITED', 'INTERNAL'] }, message: { type: 'string' } },
            },
          },
        },
        Health: {
          type: 'object',
          properties: {
            status: { const: 'ok' },
            uptimeSeconds: { type: 'number' },
            provider: { type: 'string' },
            cache: { type: 'object', properties: { size: { type: 'integer' }, hits: { type: 'integer' }, misses: { type: 'integer' } } },
          },
        },
        Condition: {
          type: 'object',
          properties: { code: { type: 'integer' }, key: { type: 'string' }, label: { type: 'string' }, isDay: { type: 'boolean' } },
        },
        Location: {
          type: 'object',
          required: ['id', 'name', 'country', 'countryCode', 'lat', 'lon', 'timezone', 'utcOffsetSeconds'],
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, admin1: { type: 'string' }, country: { type: 'string' }, countryCode: { type: 'string' },
            lat: { type: 'number' }, lon: { type: 'number' }, timezone: { type: 'string' }, utcOffsetSeconds: { type: 'integer' }, elevation: { type: 'number' },
          },
        },
        WeatherAlert: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: [...ALERT_TYPES] }, severity: { type: 'string', enum: ['advisory', 'warning'] }, title: { type: 'string' },
            description: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, source: { type: 'string', enum: ['derived', 'official'] },
          },
        },
        TodayWeather: contractType('TodayWeather', {
          properties: {
            location: ref('Location'), current: { type: 'object' }, comparison: { type: 'object' }, today: { type: 'object' },
            hourly: { type: 'array', items: { type: 'object' }, maxItems: 48 }, daily: { type: 'array', items: { type: 'object' }, maxItems: 10 },
            air: { type: ['object', 'null'] }, lifeIndices: { type: 'array', items: { type: 'object' } }, alerts: { type: 'array', items: ref('WeatherAlert') },
            clothing: { type: 'object', properties: { summary: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } },
          },
        }),
        AirQualityReport: contractType('AirQualityReport'),
        ForecastComparison: contractType('ForecastComparison'),
        NationSnapshot: contractType('NationSnapshot'),
        Region: {
          type: 'object',
          required: ['id', 'name', 'country', 'lat', 'lon'],
          properties: {
            id: { type: 'string', example: 'mn-ulaanbaatar' }, name: { type: 'string' }, country: { type: 'string', example: 'MN' },
            lat: { type: 'number' }, lon: { type: 'number' },
            bbox: { type: 'object', properties: { minLat: { type: 'number' }, minLon: { type: 'number' }, maxLat: { type: 'number' }, maxLon: { type: 'number' } } },
          },
        },
        NotificationPreferences: {
          type: 'object',
          properties: {
            alertTypes: { type: 'array', items: { type: 'string', enum: [...ALERT_TYPES] }, default: [...ALERT_TYPES] },
            minSeverity: { type: 'string', enum: ['advisory', 'warning'], default: 'advisory' },
            aiRiskThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.6 },
            dailyBriefingHour: { type: ['integer', 'null'], minimum: 0, maximum: 23, default: null },
            airGradeThreshold: { type: ['string', 'null'], enum: ['good', 'moderate', 'bad', 'very-bad', null], default: 'bad' },
            quietHours: { type: ['object', 'null'], properties: { start: { type: 'integer' }, end: { type: 'integer' } }, default: null },
            locale: { type: 'string', enum: ['en', 'mn', 'ko'], default: 'en' },
          },
        },
        DeviceRegistration: {
          type: 'object',
          required: ['pushToken', 'platform'],
          properties: {
            pushToken: { type: 'string', minLength: 1 },
            platform: { type: 'string', enum: ['ios', 'android', 'web'] },
            regionIds: { type: 'array', items: { type: 'string' }, description: 'Must exist in /regions; may be empty only with followLocation + lastLocation' },
            lastLocation: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' } } },
            followLocation: { type: 'boolean', default: false },
            preferences: ref('NotificationPreferences'),
            appVersion: { type: 'string' },
          },
        },
        Device: {
          allOf: [ref('DeviceRegistration'), { type: 'object', properties: { id: { type: 'string' }, createdAt: { type: 'string' }, updatedAt: { type: 'string' } } }],
        },
        NotificationMessage: {
          type: 'object',
          properties: {
            id: { type: 'string' }, kind: { type: 'string', enum: ['alert', 'ai-risk', 'air-quality', 'daily-briefing', 'test'] }, regionId: { type: 'string' },
            title: { type: 'string' }, body: { type: 'string' }, deepLink: { type: 'string' }, severity: { type: 'string' }, dedupKey: { type: 'string' },
            sentAt: { type: 'string' }, data: { type: 'object', additionalProperties: { type: 'string' } }, deliveredTo: { type: 'integer', description: 'History entries only' },
          },
        },
      },
    },
  };
}
