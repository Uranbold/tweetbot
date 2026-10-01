# Skycast — weather platform modeled on weather.naver.com

A multi-tier reference implementation: business analysis, system architecture, UX design system, a Node BFF, a React web app, a Python AI prediction service and an Expo mobile app with region-based danger notifications.

```
weather/
├── docs/
│   ├── BA.md          Business analysis: Naver benchmark, personas, FR/NFR, business rules, backlog, KPIs
│   ├── SA.md          System architecture: C4 diagrams, runtime flows, API, caching, security, ADRs
│   └── UX.md          UX & design system: tokens, validated palette, Laws of UX applied, component specs
├── shared/contract.ts Single typed API contract shared by every tier
├── backend/           Fastify 5 BFF: aggregation, domain rules, cache, provider fallback, /predict proxy,
│                      device registry and the push-notification dispatcher           → :8787
├── ai/                FastAPI ML service: NWP bias correction, P10/P90 quantiles, calibrated precipitation,
│                      Monte-Carlo hazard probabilities, explainability                 → :8790
├── frontend/          React 18 + Vite SPA: Home · Compare · Air · Map, AI forecast card → :5173 (dev) / :8080 (docker)
├── mobile/            Expo (iOS/Android) app: Today · AI · Alerts · Settings, region subscriptions, push
└── docker-compose.yml ai + backend + frontend
```

## Quick start

### Everything with Docker

```bash
cd weather
docker compose up --build
# web  http://localhost:8080      api http://localhost:8787/api/v1/health      ai http://localhost:8790/health
```

### Local development (three terminals)

```bash
# 1. AI service
cd weather/ai && python3.11 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
DATA_MODE=auto uvicorn skycast_ai.app:app --port 8790 --reload

# 2. Backend
cd weather/backend && npm install && npm run dev          # http://localhost:8787

# 3. Web
cd weather/frontend && npm install && npm run dev         # http://localhost:5173 (proxies /api → :8787)

# Mobile (Expo Go on a phone, same Wi-Fi)
cd weather/mobile && npm install
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8787/api/v1 npx expo start
```

Each tier's own README documents its environment variables, scripts and tests.

## Verifying

| Tier | Command |
|---|---|
| backend | `npm run typecheck && npm test && npm run build` |
| frontend | `npm run typecheck && npm test && npm run build` |
| ai | `ruff check . && pytest` |
| mobile | `npx tsc --noEmit && npx jest --ci && npx expo export --platform web` |

Smoke test once the backend and AI service are up:

```bash
curl -s 'localhost:8787/api/v1/weather?lat=47.92&lon=106.92' | head -c 400
curl -s 'localhost:8787/api/v1/predict?lat=47.92&lon=106.92' | head -c 400
curl -s -X POST localhost:8787/api/v1/devices -H 'content-type: application/json' \
  -d '{"pushToken":"ExponentPushToken[test]","platform":"android","regionIds":["mn-ulaanbaatar"],"followLocation":false,
       "preferences":{"alertTypes":["cold-wave","strong-wind"],"minSeverity":"advisory","aiRiskThreshold":0.6,
       "dailyBriefingHour":7,"airGradeThreshold":"bad","quietHours":null,"locale":"mn"}}'
```

## Data and degraded mode

All data comes from [Open-Meteo](https://open-meteo.com) (CC BY 4.0): forecast, multi-model ensemble, air quality (CAMS), geocoding and the historical archive used to train the AI models. The free tier is rate-limited per IP; when an upstream returns 429 or fails, the backend serves the last good value (`meta.stale: true`) or deterministic demo data (`meta.mock: true`), and the UI labels both. The AI service never applies a synthetically trained model to a real forecast: it passes the NWP through and reports `algorithm: climatology-fallback` until real history is available.

## Notifications end to end

1. The mobile app requests permission, obtains an Expo push token and registers with `POST /api/v1/devices` (regions, preferences, optional last location).
2. Every 10 minutes the backend dispatcher evaluates each region that has subscribers: derived KMA-style alerts (BA §7 BR-02), AI hazard probabilities from `/predict`, air-quality grade and daily briefings.
3. Messages are filtered per device (alert types, minimum severity, AI threshold, quiet hours), de-duplicated for 24 h per `(region, kind, hazard, day)`, localised (en / mn / ko) and sent through the Expo Push API (`PUSH_MODE=expo`; `log` in development).
4. A tap opens the deep link `skycast://region/<id>/alerts`.

## Screenshots (live stack, real Open-Meteo data)

| | |
|---|---|
| [Home, desktop, light](docs/screens/home-1280-light.png) | [Home, phone, dark](docs/screens/home-390-dark.png) |
| [Air quality, desktop](docs/screens/air-1280-light.png) | [Compare forecasts, dark](docs/screens/compare-1280-dark.png) |
| [Map](docs/screens/map-1280-light.png) (OSM tiles blocked in the build sandbox) | |
| [Mobile: Today](docs/screens/mobile-today-tall-light.png) | [Mobile: AI forecast](docs/screens/mobile-ai-light.png) |
| [Mobile: Regions & notification settings, dark](docs/screens/mobile-settings-tall-dark.png) | |

Mobile screenshots are from the Expo web export in fixture mode (no device in the build sandbox).

## Documents

Read them in order: [BA.md](docs/BA.md) (why and what) → [SA.md](docs/SA.md) (how) → [UX.md](docs/UX.md) (how it looks and behaves) → [`shared/contract.ts`](shared/contract.ts) (the exact API).
