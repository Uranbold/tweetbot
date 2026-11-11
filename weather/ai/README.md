# Skycast AI prediction module (`weather/ai`)

A small Python service that **post-processes numerical weather prediction (NWP) output** for a
location and returns the contract type `AiPrediction` (see `weather/shared/contract.ts`,
section "/predict"). The Node backend proxies it at `GET /api/v1/predict`.

## What it is, and what it is not

This is the same kind of "AI weather" that national met services run operationally: *statistical
post-processing* (MOS / EMOS-style) on top of physics-based models. Per location it

1. learns the systematic error of the NWP temperature (`observation − forecast`) from the last year
   of hourly data and corrects it (`temperature` vs `temperatureNwp`);
2. blends several NWP models (ECMWF IFS, GFS, ICON, Open-Meteo best-match) with weights
   proportional to the inverse of each member's validation MAE;
3. fits P10 / P90 quantile regressors for an uncertainty band that widens with lead time and
   ensemble spread;
4. calibrates precipitation-occurrence probability (gradient-boosted classifier + isotonic
   regression);
5. turns the predicted distribution into **hazard probabilities** by Monte Carlo sampling against the
   KMA special-report thresholds (heat wave, cold wave, heavy rain, heavy snow, strong wind, dry);
6. writes a deterministic, template-based plain-English summary.

It is **not** a foundation weather model, it does not replace the NWP forecast and it has no skill
beyond what the input models contain. Honest limitations:

* **Training data.** "Observations" are the ERA5 / ERA5-Land reanalysis (`models=era5_seamless`,
  ~5 day lag), not station observations, and the "historical forecast" is a single daily run; the
  training lead time is therefore the hour-of-day (0–23 h) while inference goes out to 168 h.
  Gotcha found while building this: the archive's default `best_match` serves recent periods from the
  archived ECMWF IFS run, which is *exactly* the historical-forecast API's `best_match`, so the
  residual is identically zero. The service asks for `era5_seamless` and additionally refuses to
  train when obs ≡ forecast (falls back to climatology with an explicit reason). The uncertainty band is inflated with lead
  time (`√(1 + lead/72)`) to compensate, which is a heuristic, not a calibrated result.
* **Upstream rate limits.** From a shared IP Open-Meteo frequently answers `429 Daily API request
  limit exceeded`. In `DATA_MODE=auto` the service then falls back to a **deterministic synthetic
  data source** (seeded by lat/lon: seasonal + diurnal cycles, AR(1) weather, plausible NWP biases)
  and marks the response `meta.mock = true`. Synthetic predictions are internally consistent and
  exercise every code path, but they are not a forecast for the real atmosphere. When the live
  forecast *is* available but the training history is not (the common 429 case: the forecast
  endpoint has a separate quota), a correction learned from synthetic data is **not** applied to the
  real forecast: the service passes the NWP through (`temperature == temperatureNwp`), reports
  `model.algorithm = "climatology-fallback"` with `trainingSamples = 0`, and retries live history
  after an hour.
* **Hazards** are threshold crossings of the *predicted* variables. `fine-dust` needs air-quality
  data and `typhoon` needs cyclone tracks, so both are left out of `hazardProbabilities` and `risks`.
  Snowfall is estimated from precipitation at ≤ 0 °C (1 mm ≈ 1 cm), wind gust ≈ 1.5 × wind when the
  model has no gust field, "feels like" is the Steadman apparent temperature.
* The reported metrics are from a single time-ordered 80/20 split of one year; no cross-validation.

## Run

```bash
cd weather/ai
make setup            # python3.11 -m venv .venv && pip install -r requirements*.txt
make test             # ruff check . && pytest
make run              # uvicorn skycast_ai.app:app --port 8790   (DATA_MODE=auto)
make run-synthetic    # same, never calls Open-Meteo

# or by hand
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
ruff check . && pytest
uvicorn skycast_ai.app:app --host 0.0.0.0 --port 8790
curl 'http://localhost:8790/predict?lat=47.92&lon=106.92&hours=72'
```

Docker: `make docker-build && make docker-run` (image `python:3.11-slim`, non-root user, data volume
at `/data` for the response cache and the model files).

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8790` | HTTP port (`python -m skycast_ai` / Dockerfile) |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_MODE` | `auto` | `auto` = live Open-Meteo with synthetic fallback on 429/5xx/timeout; `live` = no fallback (errors become 503); `synthetic` = never call upstream |
| `CACHE_DIR` | `weather/ai/.cache` | Raw upstream JSON cache (TTL below) |
| `MODEL_DIR` | `weather/ai/.models` | Per-location joblib model files, keyed by lat/lon rounded to 2 dp |
| `UPSTREAM_TIMEOUT_S` | `6` | httpx timeout for each Open-Meteo call |
| `LOG_LEVEL` | `INFO` | Python log level (key=value structured lines) |
| `HISTORY_DAYS` | `365` | Training window length |
| `HISTORY_CACHE_TTL_S` | `86400` | TTL for archive / historical-forecast responses |
| `FORECAST_CACHE_TTL_S` | `3600` | TTL for the live multi-model forecast |
| `MODEL_TTL_S` | `86400` | Retrain a cached model after this (models trained on synthetic data retrain after 1 h so live data is picked up again) |
| `MAX_TRAINING_SAMPLES` | `8760` | Cap on training rows (keeps training ≈ 2 s) |
| `HAZARD_SAMPLES` | `200` | Monte Carlo scenarios per request |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

## Endpoints

| Method / path | Returns | Notes |
|---|---|---|
| `GET /predict?lat&lon&hours=72` | `{ data: AiPrediction, meta }` | `hours` ∈ [24, 168]; trains the location model lazily on first call (~2–3 s), then < 200 ms |
| `GET /model-info?lat&lon` | `{ data: ModelInfo, meta, diagnostics }` | `diagnostics` is extra (member MAEs, weights, split dates, training time) |
| `POST /train?lat&lon` | same as `/model-info` | Forces a retrain |
| `GET /health` | `{ status, service, version, uptimeSeconds, dataMode, modelsLoaded }` | |
| `GET /openapi.json`, `GET /docs` | OpenAPI 3.1 | Generated by FastAPI |

Errors follow the contract's `ApiError`: `{"error": {"code": "BAD_REQUEST" | "UPSTREAM_UNAVAILABLE" |
"RATE_LIMITED" | "INTERNAL", "message": "..."}}`. Invalid `lat`/`lon`/`hours` → 400.

`meta`: `{"provider": "skycast-ai", "fetchedAt": "<UTC ISO>", "stale": false, "mock": <bool>}`.
`mock` is `true` when either the live forecast or the training data came from the synthetic source.

## How the backend should call it

```
AI_SERVICE_URL=http://ai:8790        # docker-compose service name, or http://localhost:8790

GET  ${AI_SERVICE_URL}/predict?lat=${lat}&lon=${lon}&hours=${hours ?? 72}
```

* Pass the user's coordinates through unchanged; the service rounds them to 2 dp for the model key
  and `location.id` and names the location from a small built-in gazetteer (nearest city within
  50 km, else `"47.92°N 106.92°E"` with `country: ""`).
* Forward the body as-is: it already is `ApiResponse<AiPrediction>` with camelCase keys; copy
  `meta` through so the UI can show the `mock` badge.
* Map a non-2xx body `{error:{code,message}}` to the same status; on a connection error or timeout
  (allow ≥ 10 s for the first call per location, which trains the model) answer
  `503 UPSTREAM_UNAVAILABLE`.
* Cache for ~10 minutes per rounded lat/lon; the service's own data cache means repeated calls are
  cheap, but hazards are re-sampled per request (deterministically seeded per location and hour).

## Layout

```
skycast_ai/
  app.py            FastAPI factory (create_app), error envelope, CORS, access log
  predictor.py      orchestration: data → model → prediction → hazards → summary
  schemas.py        pydantic v2 models mirroring contract.ts (camelCase aliases)
  settings.py       pydantic-settings
  locations.py      gazetteer + Location builder
  features.py       feature engineering (shared by training and inference)
  hazards.py        Monte Carlo hazard probabilities (KMA thresholds)
  summary.py        deterministic text summary
  data/             DataSource protocol, Open-Meteo client, synthetic generator, fallback, disk cache
  models/           trainer (HGB/Ridge residual, quantile HGB, calibrated classifier, blend weights),
                    climatology fallback, joblib store
tests/              pytest suite (synthetic determinism, features, model skill, hazards, API)
```
