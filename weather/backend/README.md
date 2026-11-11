# Skycast backend

Weather API / BFF for the Skycast portal (modelled on weather.naver.com). Node 22, TypeScript (strict, ESM), Fastify 5, zod, vitest. Implements `../shared/contract.ts` exactly; the frontend and mobile app import the same type-only contract.

Data: [Open-Meteo](https://open-meteo.com) forecast, air-quality and geocoding APIs (CC BY 4.0), the Skycast AI service (`../ai`, proxied at `/predict`) and a deterministic mock provider that takes over when Open-Meteo is unavailable (flagged by `meta.mock`).

## Run

```bash
npm install
npm run dev          # tsx watch, http://localhost:8787
npm run typecheck    # tsc --noEmit
npm test             # vitest run (313+ tests)
npm run build        # tsup → dist/server.js (single ESM bundle; contract import is erased)
npm start            # node dist/server.js
```

Docker (multi-stage, non-root, context = this directory):

```bash
docker build -t skycast-backend . && docker run -p 8787:8787 -e PROVIDER_MODE=auto skycast-backend
```

Smoke test:

```bash
curl -s localhost:8787/api/v1/health
curl -s 'localhost:8787/api/v1/weather?lat=47.92&lon=106.92' | head -c 600
curl -s 'localhost:8787/api/v1/compare?lat=37.57&lon=126.98&models=ecmwf,gfs'
curl -s 'localhost:8787/api/v1/nation?region=mn'
curl -s 'localhost:8787/api/v1/locations/search?q=seoul'
```

## Endpoints (`/api/v1`)

| Method & path | Returns | Cache TTL |
|---|---|---|
| `GET /health` | status, provider mode, cache hits/misses, upstream fallback stats, `ai: reachable\|unreachable`, dispatcher stats | none |
| `GET /locations/search?q&limit` | `Location[]` | 24 h |
| `GET /locations/reverse?lat&lon` | `Location` (nearest catalogue city within 30 km, else ad-hoc `"lat,lon"`) | 24 h |
| `GET /weather?lat&lon` | `TodayWeather` (current, yesterday diff, 48 h, 10 days, air, life indices, alerts, clothing) | 10 min |
| `GET /air?lat&lon` | `AirQualityReport` (72 h, 4-day grades, grade scale) | 30 min |
| `GET /compare?lat&lon&models=ecmwf,gfs` | `ForecastComparison` with consensus/agreement | 60 min |
| `GET /nation?region=mn\|kr\|world` | `NationSnapshot` (10 cities, one batched upstream call) | 15 min |
| `GET /regions` | `Region[]` (one per catalogue city, ids like `mn-ulaanbaatar`) | static |
| `GET /regions/:id/alerts` | `{ alerts, risks, air }` for a region | as /weather |
| `GET /predict?lat&lon&hours=72` | `AiPrediction` proxied from the AI service (never mocked; stale on failure) | 30 min |
| `POST /devices` · `GET/PATCH/DELETE /devices/:id` | `Device` (upsert by `pushToken`) | no-store |
| `GET /devices/:id/notifications` | last 50 `NotificationHistoryEntry` | no-store |
| `POST /devices/:id/test-notification` | `NotificationMessage` | no-store |
| `GET /openapi.json` | OpenAPI 3.1 | 1 h |

Every success body is `ApiResponse<T> = { data, meta: { provider, fetchedAt, stale, mock } }`; errors are `{ error: { code, message } }` with codes `BAD_REQUEST` (400), `NOT_FOUND` (404), `RATE_LIMITED` (429), `UPSTREAM_UNAVAILABLE` (503, or 502 when the upstream rejected our request), `INTERNAL` (500). Responses carry `Cache-Control: public, max-age=<ttl>` and `X-Cache: HIT|MISS|STALE`.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` / `HOST` | `8787` / `0.0.0.0` | Listen address |
| `LOG_LEVEL` | `info` | pino level (`silent` in tests) |
| `PROVIDER_MODE` | `auto` | `live` (Open-Meteo only, 503 on failure), `mock` (deterministic synthetic data), `auto` (live, fall back to mock on 429 / 5xx / timeout / network / bad payload) |
| `UPSTREAM_TIMEOUT_MS` | `6000` | Per-request timeout for Open-Meteo and Expo (AbortController) |
| `UPSTREAM_COOLDOWN_MS` | `60000` | In auto mode, skip the live provider for this long after a fallback-worthy failure |
| `CACHE_TTL_WEATHER` / `_AIR` / `_COMPARE` / `_NATION` / `_GEOCODE` / `_PREDICT` | `600` / `1800` / `3600` / `900` / `86400` / `1800` | Response TTLs (seconds) |
| `CACHE_TTL_MOCK_FALLBACK` | `120` | TTL for mock-fallback responses in auto mode (so live data returns quickly) |
| `CACHE_STALE_TTL` | `21600` | How long expired entries are retained for stale-while-error (6 h, BR-08) |
| `CACHE_MAX_ENTRIES` | `5000` | LRU size |
| `CORS_ORIGIN` | `*` | Comma-separated allow-list, or `*` |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `120` / `60000` | Per-IP rate limit (`/health` exempt) |
| `TRUST_PROXY` | `false` | Trust `X-Forwarded-For` for the rate limiter |
| `AI_SERVICE_URL` | `http://localhost:8790` | Skycast AI service base URL (`GET /predict`, `GET /health`) |
| `AI_TIMEOUT_MS` | `20000` | Timeout for the AI service (first call per location trains a model, ~3.5–5 s; concurrent cold starts have been observed near 20 s) |
| `PUSH_MODE` | `log` | `log` records pushes in the process log; `expo` posts to the Expo Push API in chunks of 100 |
| `EXPO_ACCESS_TOKEN` | – | Optional bearer token for Expo push |
| `DISPATCH_ENABLED` | `true` | Run the notification dispatcher on a timer (tests set `false`) |
| `DISPATCH_INTERVAL_MS` | `600000` | Dispatcher interval (10 min) |

## Architecture

Hexagonal / layered. Dependency rule: `http → services → (domain, ports)`; adapters implement ports; the domain imports nothing from Fastify, fetch or vendor JSON.

```
src/
├── config.ts                 env → typed config (zod)
├── server.ts                 entrypoint: config → container → Fastify → dispatcher timer
├── container.ts              composition root; tests inject fakes via `overrides`
├── types.ts                  `export type * from '../../shared/contract'` (erased at build)
├── errors.ts                 AppError hierarchy → ApiError codes; UpstreamError(kind) drives fallback
├── http/                     buildApp(container): CORS, rate limit, zod validation → 400, error handler,
│   ├── routes/               Cache-Control + X-Cache, pino request logs (lat/lon rounded), OpenAPI
│   └── schemas.ts            query/body schemas (contract validation rules)
├── services/                 WeatherService (forecast ∥ air; air failure → air:null), AirService,
│   │                         CompareService (BR-06 consensus), NationService (batched coords),
│   │                         LocationService, RegionService, PredictService (AI proxy), RegionAlertsService
│   └── assemble.ts           pure provider-data → contract payload assembly (fixture-tested)
├── domain/                   pure rules: wmo, air (BR-01), alerts (BR-02), comparison (BR-03),
│                             clothing (BR-04), lifeIndices + feelsLike (BR-05), consensus (BR-06),
│                             halfday (BR-07), headline, sun (NOAA solar position), models
├── providers/
│   ├── ports.ts              WeatherProvider, AirQualityProvider, GeocodingProvider, ModelComparisonProvider
│   ├── openmeteo/            http (fetch + AbortController → UpstreamError), parse (zod), adapters
│   ├── mock/                 deterministic synthetic climate (seeded by lat/lon + time), catalogue geocoding
│   ├── fallback.ts           live → mock decorators with per-host cooldown and stats (/health.upstream)
│   └── catalog.ts            reverse geocoding by nearest city; time-zone guess for ad-hoc coordinates
├── cache/                    Cache port (Redis-ready), MemoryLruCache (LRU + TTL + stale retention),
│                             ReadThroughCache (single-flight, stale-while-error, hit/miss stats)
├── notifications/            DeviceRepository + NotificationHistoryRepository (ports + in-memory),
│                             PushSender (ExpoPushSender / LogPushSender), Dispatcher, DeviceService, i18n
└── data/cities.ts            city catalogue (GeoNames ids): mn / kr / world groups + notification regions
```

Key behaviours:

* **Cache keys** round coordinates to 2 decimals (~1 km). Concurrent identical requests share one upstream call (single-flight). When a refresh fails, the last value (≤ 6 h old) is served with `meta.stale: true` and `X-Cache: STALE`.
* **Auto mode** never lets a mock result overwrite a cached real one: if Open-Meteo fails and a real value is still retained, that is served as STALE; otherwise the mock answer is served (`meta.mock: true`) with a short TTL. One cooldown per upstream host, so a forecast 429 does not disable air quality or geocoding.
* **Nation snapshot** sends all 10 cities as comma-separated `latitude`/`longitude` lists (one forecast request, one air request).
* **Reverse geocoding** has no free Open-Meteo endpoint: it resolves to the nearest catalogue city within 30 km, else an ad-hoc `Location` with id `"lat,lon"` and name like `37.57°N 126.98°E`.
* **Mock provider** is seeded by rounded coordinates and time: latitude/season baseline, elevation lapse rate, diurnal cycle on local solar time, smooth synoptic noise, condition codes derived from the same precipitation/cloud fields (codes, POP and mm always agree), NOAA sunrise/sunset, Ulaanbaatar winter smog in the air mock.
* **Notification dispatcher** (`runOnce(now)`, every `DISPATCH_INTERVAL_MS`): for each region with ≥ 1 device (subscribed, or nearest to `lastLocation` when `followLocation`), evaluates BR-02 alerts, AI risks (deduped per hazard to the highest severity ≥ `aiRiskThreshold`), air grade ≥ `airGradeThreshold`, and the daily briefing at `dailyBriefingHour` (region local time); applies `alertTypes`, `minSeverity`, `quietHours` (local), `locale` (en/mn/ko); dedup key `${regionId}:${kind}:${hazard|grade|day}:${YYYY-MM-DD}` with a 24 h window; sends in Expo chunks of 100; `DeviceNotRegistered` tickets delete the device; history keeps the last 50 per device. Stats are exposed in `/health.notifications.dispatcher`.

## Tests

`test/domain` (every rule incl. boundaries), `test/cache` (TTL, LRU, stale-while-error, single-flight), `test/providers` (mock determinism/plausibility, Open-Meteo parsing from recorded fixtures in `test/fixtures`, HTTP error mapping, fallback policy), `test/services` (assembly from fixtures), `test/http` (every route via `app.inject()`, validation 400s, auto-fallback on 429, stale, rate limit, CORS, AI proxy), `test/notifications` (repositories, Expo sender chunking, dispatcher rules).

Fixtures `air-quality-ulaanbaatar.json`, `geocoding-seoul.json`, `snapshots-korea2.json`, `air-current-korea2.json`, `forecast-ulaanbaatar.json` and `compare-ulaanbaatar.json` are real Open-Meteo responses recorded on 2026-10-01.
