# Skycast: Business Analysis (BA)

| | |
|---|---|
| Document | Business Analysis / Product Requirements |
| Product | Skycast, a weather portal modeled on weather.naver.com |
| Version | 1.0 (MVP baseline) |
| Date | 2026-10-01 |
| Related | [SA.md](./SA.md) (System Architecture), [`shared/contract.ts`](../shared/contract.ts) (API contract) |

---

## 1. Executive summary

Skycast is a consumer weather portal that copies how Naver Weather (weather.naver.com) is organised: a dense Home page of cards built for a quick glance, forecasts from several providers side by side, a dedicated fine-dust section, and a nationwide map. Naver serves Korea. Skycast is built for **any location**, starting with **Mongolia and Korea**. In Ulaanbaatar, winter air pollution is as big a daily decision factor as temperature, so the air-quality tab is a first-class feature, not an add-on.

The MVP is a responsive web app (SPA + BFF API). It is built on open data (Open-Meteo, CC BY 4.0), so there is no licensing cost at launch. Its provider-adapter architecture lets official national sources (KMA, NAMEM, AirKorea) plug in later without changing the frontend.

---

## 2. Benchmark research: weather.naver.com

Research method: inspected the live page structure of `https://weather.naver.com/today` on 2026-10-01 (section headings, card components, map layers, legends and help texts) and mapped each feature to a user need.

### 2.1 Information architecture

| Naver tab (KR) | English | What it does | Skycast MVP |
|---|---|---|---|
| 날씨 홈 | Home | Card stack for the selected location | ✅ |
| 예보비교 | Forecast compare | Shows KMA, AccuWeather, The Weather Channel and Weathernews side by side | ✅ (NWP models: ECMWF, GFS, ICON, JMA, KMA, GEM, Météo-France) |
| 미세먼지 | Fine dust | PM10/PM2.5 grades, forecast, station data | ✅ |
| 지도 | Map | Layers: typhoon, earthquake, warnings, forecast, satellite, radar, observation, air quality, wind animation | ✅ partial (city markers: temperature / air layer) |
| 세이프티 | Safety | Disaster and safety info | ⏭ Phase 2 |
| 최근 본 지역 / 관심지역 | Recent / favourite locations | Star to favourite, recent list | ✅ |
| 지역 검색 | Location search | Down to township (읍·면·동) level | ✅ (geocoder; city/town level) |

### 2.2 Home page cards (top → bottom)

1. **Current summary** (`card_forecast_today`): temperature, condition, a "compared to yesterday" line (어제보다 2° 높아요), feels-like, humidity, wind, PM10/PM2.5 chips, UV, sunrise/sunset.
2. **Weather warnings / alarm** (`common_alarm`): active KMA special reports (특보).
3. **Hourly graph** (`card_weather_graph`): temperature line plus switchable rows: precipitation probability, *clothing* (옷차림), precipitation mm, snowfall cm, humidity, wind m/s, children/elderly (아이·노약자), golf turf (잔디), playing time (경기시간).
4. **Life & health indices** (`오늘의 생활·보건 지수`): sourced from KMA, the National Health Insurance Service and WeatherI.
5. **Weekly forecast** (`card_week`): one row per day with **AM/PM** icon and precipitation probability, and min/max.
6. **KMA bulletin** (`기상청 통보문`, `card_weather_report`): forecaster's text summary.
7. **Nationwide weather** (`전국날씨`, `nation_map`).
8. **Sunrise / sunset** (`일출일몰`).
9. **News** (`card_news`) and **golf course comparison** (`card_golf_compare`).

### 2.3 Data and business rules Naver exposes

* **Provider policy:** domestic data comes from KMA (ultra-short-term nowcast, ultra-short-term forecast, short-term forecast). Foreign data comes from one of AccuWeather, Weathernews or The Weather Channel.
* **Hourly semantics:** temperature, wind and humidity are values *on the hour*. Precipitation is the *amount expected over the next hour*.
* **Air quality:** comes from AirKorea station data (beta-ray method). Forecast maps are model output and are labelled as possibly differing from official forecasts. They cover 12–52 h.
* **Air grade legend (Korean MoE 4-tier):** see BR-01 below.
* **Warning taxonomy (특보):** each hazard has an advisory (주의보) and a warning (경보) for heat wave, dry, yellow dust, tropical night, storm surge, high seas, strong wind, typhoon, heavy rain, cold wave and heavy snow. Published thresholds include:
  * Strong wind advisory: ≥ 14 m/s, or gust ≥ 20 m/s (mountains: 17 / 25). Warning: ≥ 21 m/s, or gust ≥ 26 m/s.
  * Heavy rain advisory: ≥ 60 mm/3 h or ≥ 110 mm/12 h. Warning: ≥ 90 mm/3 h or ≥ 180 mm/12 h.
  * Heavy snow advisory: ≥ 5 cm/24 h new snow. Warning: ≥ 20 cm (mountains 30 cm).
  * Dry advisory: effective humidity ≤ 35 % for 2+ days. Warning: ≤ 25 %.
* **Map legends:** temperature bands (≤ −10 to ≥ 30 °C), precipitation (≤ 1 to ≥ 50 mm), precipitation probability (20 % steps), wind (≤ 1 to ≤ 60 m/s), typhoon intensity (17–24 to ≥ 54 m/s).

### 2.4 What makes Naver Weather successful (design principles to copy)

| Principle | Evidence | Skycast translation |
|---|---|---|
| **Answer "what does it mean for me?"** | Clothing row, life indices, "warmer than yesterday" | Clothing advice, life indices and yesterday comparison come back in the same `/weather` payload |
| **Trust through transparency** | Shows several providers side by side, explains data semantics | Compare tab with an *agreement* badge; `meta.provider`, `mock` and `stale` shown in the UI |
| **Glanceability** | The first card answers most visits | The current card works on its own and leads the page on mobile |
| **Localised hazards** | KMA warnings and fine dust are prominent | Derived warnings with KMA thresholds; air grades as chips on the first card |
| **Habit loops** | Favourites, recents, location search | Favourites and recents stored in the browser; shareable URLs |

### 2.5 Competitive landscape

| Product | Strength | Gap Skycast exploits |
|---|---|---|
| Naver Weather | Deep Korea coverage, lifestyle indices | Korea-centric; Korean only |
| Weather.com / AccuWeather | Global, radar | Ad-heavy; no Korean-style AQ grades or lifestyle indices |
| Apple / Google weather | OS-level convenience | No multi-model comparison; weak air-quality guidance |
| NAMEM (tsag-agaar.gov.mn) | Official Mongolian source | Dated UX, little mobile optimisation, no lifestyle layer |
| IQAir | Air-quality depth | Weather is secondary |

---

## 3. Problem statement and goals

**Problem.** People in Ulaanbaatar and Seoul make daily decisions (what to wear, whether to wear a mask, whether to hang laundry, whether children can play outside) based on weather *and* air quality. Today they have to combine several apps to do that. Existing local official sites are not mobile-friendly and show raw numbers without guidance.

**Vision.** *One glance, one decision.* Skycast turns forecasts into actionable guidance and stays transparent about how certain the forecast is.

### 3.1 Business goals and KPIs

| # | Goal | KPI | MVP target (90 days post-launch) |
|---|---|---|---|
| G1 | Daily habit | DAU/MAU | ≥ 35 % |
| G2 | Fast answers | Time to first meaningful paint of the current card (4G) | ≤ 2.0 s p75 |
| G3 | Trust | Share of sessions that open Compare or Air | ≥ 20 % |
| G4 | Reliability | API availability, with mock/stale fallback counted as degraded rather than down | ≥ 99.5 % |
| G5 | Cost efficiency | Upstream calls per 1,000 page views (cache effectiveness) | ≤ 150 |
| G6 | Retention | Users with ≥ 1 favourite | ≥ 25 % of returning users |
| G7 | Forecast skill | AI temperature MAE vs raw NWP (24 h lead, validation) | ≥ 15 % lower |
| G8 | Notification value | Push opt-in rate / opt-out within 30 days | ≥ 60 % / ≤ 10 % |
| G9 | Alert timeliness | Time from threshold crossing in forecast to push delivered | ≤ 10 min p95 |

---

## 4. Stakeholders and personas

### 4.1 Stakeholders

| Stakeholder | Interest |
|---|---|
| Product owner | Feature priority, KPIs |
| End users (public) | Accurate, quick, actionable info |
| Data providers (Open-Meteo; later NAMEM, KMA, AirKorea) | Licence compliance, attribution, fair use |
| Ops / SRE | Uptime, cost, observability |
| Advertising / B2B partners (Phase 3) | Inventory, API access |
| Regulators / public-health bodies | Correct presentation of air-quality and hazard warnings |

### 4.2 Personas

| Persona | Context | Primary jobs-to-be-done |
|---|---|---|
| **Saraa, 34, parent in Ulaanbaatar** | Winter smog; two children in kindergarten | "Is the PM2.5 OK for the kids outside today?" "What should they wear at −25 °C?" |
| **Min-jun, 28, commuter in Seoul** | Subway and walking | "Will it rain on my way home at 18:00?" "Do I need a mask?" |
| **Bat-Erdene, 45, herder / logistics driver** | Travels between aimags | "Are there strong winds or snow on my route over the next 3 days?" "Which cities are coldest?" |
| **Ji-woo, 31, weather enthusiast** | Checks several sources | "Do the models agree on the weekend rain?" |

---

## 5. Scope

### 5.1 In scope (MVP, release 1.0)

* Location search (autocomplete), reverse geolocation, favourites, recents, preset cities
* Home: current conditions, yesterday comparison, headline, 48 h hourly, 10-day AM/PM, life indices, clothing, alerts, air summary, sun arc, nationwide grid
* Air-quality page: PM10, PM2.5, O₃, NO₂, SO₂, CO; 72 h hourly; 4-day daily grade forecast; legend
* Forecast compare: up to 7 NWP models, consensus and agreement
* Map: city markers by region (Mongolia / Korea / World); temperature and air layers
* Light/dark theme, responsive layout from 320 px to desktop, WCAG 2.1 AA
* Degraded mode: deterministic demo data when the upstream fails, clearly labelled
* **AI prediction module**: bias-corrected 72 h forecast with uncertainty bands and hazard probabilities (§6.6)
* **Mobile app (Expo, iOS/Android)** with **region-based push notifications** for weather danger, AI risk, air quality and daily briefings (§6.7)

### 5.2 Out of scope for MVP (roadmap)

| Phase | Items |
|---|---|
| **2: Local authority** | Official NAMEM and KMA adapters, official warnings, full Mongolian and Korean UI (i18n), radar/satellite tiles, typhoon and earthquake layers, Safety tab, PWA, user accounts and cloud-synced favourites, background geofencing for notifications, AI model retraining pipeline on real observation archives |
| **3: Monetise** | B2B weather API with keys and quotas, sponsored life-index cards, golf and ski venue pages, news feed, native apps |

---

## 6. Functional requirements

Priority uses **MoSCoW** (M = must, S = should, C = could).

### 6.1 Location

| ID | Requirement | Pri |
|---|---|---|
| FR-L1 | Users can search locations by name with autocomplete (≤ 8 results, 1–100 chars) | M |
| FR-L2 | Users can use device geolocation; the system reverse-geocodes it to the nearest named place | M |
| FR-L3 | Users can star or un-star a location as a favourite. Favourites survive reloads on the same device | M |
| FR-L4 | The system keeps the 10 most recent locations | S |
| FR-L5 | The selected location is reflected in the URL so it can be shared or bookmarked | M |
| FR-L6 | Default location is Ulaanbaatar, with presets Ulaanbaatar, Seoul, Tokyo and New York | M |

### 6.2 Home / Today

| ID | Requirement | Pri |
|---|---|---|
| FR-H1 | Show current temperature, feels-like, condition, humidity, wind speed/direction/gust, pressure, visibility, UV | M |
| FR-H2 | Show the temperature difference from the same hour yesterday as a sentence (BR-03) | M |
| FR-H3 | Show today's min/max, sunrise/sunset and a one-line headline | M |
| FR-H4 | Show a 48 h hourly forecast with temperature graph and switchable rows (precipitation, humidity, wind) | M |
| FR-H5 | Show a 10-day forecast with AM/PM condition and precipitation probability, and min/max on a shared scale bar | M |
| FR-H6 | Show life indices: UV, laundry, car wash, clothing, outdoor activity, food poisoning, heat index, wind chill (BR-05) | M |
| FR-H7 | Show clothing advice based on temperature bands (BR-04) | M |
| FR-H8 | Show active alerts with severity colour (BR-02) | M |
| FR-H9 | Show air-quality chips (PM10/PM2.5 grade) and a summary card that links to Air | M |
| FR-H10 | Show a nationwide city grid for the chosen region | S |
| FR-H11 | Show a sun-arc visual with the current sun position | C |

### 6.3 Air quality

| ID | Requirement | Pri |
|---|---|---|
| FR-A1 | Show current PM10, PM2.5, O₃, NO₂, SO₂, CO with grade colours | M |
| FR-A2 | Show a 72 h hourly PM chart coloured by grade | M |
| FR-A3 | Show a 4-day daily worst-grade forecast | M |
| FR-A4 | Show the grade legend, drawn from the thresholds the API returns (one source of truth) | M |

### 6.4 Forecast comparison

| ID | Requirement | Pri |
|---|---|---|
| FR-C1 | Show daily max/min and precipitation per model for the selected models | M |
| FR-C2 | Show a per-day consensus: mean, spread and agreement badge (BR-06) | M |
| FR-C3 | Show a multi-line chart of hourly temperature, one line per model | S |
| FR-C4 | Users can select which models to compare | S |

### 6.5 Map

| ID | Requirement | Pri |
|---|---|---|
| FR-M1 | Show an interactive map with city markers showing temperature and an icon for the region | M |
| FR-M2 | Users can toggle the region (Mongolia / Korea / World) | M |
| FR-M3 | Users can toggle between temperature and air-quality marker colouring | S |
| FR-M4 | Clicking a marker opens that location's Home | M |

### 6.6 AI prediction module

| ID | Requirement | Pri |
|---|---|---|
| FR-AI1 | The system produces an AI-adjusted 72 h forecast (temperature, precipitation probability) by post-processing the NWP forecast with a model trained on past forecast-vs-observation residuals for that location | M |
| FR-AI2 | Every AI value is shown next to the raw model value, with a P10–P90 uncertainty band, so users can see what the AI changed and how confident it is | M |
| FR-AI3 | The system estimates the probability (0–1) of each KMA-style hazard threshold (BR-02) being crossed per day, and lists risks ≥ 20 % with a plain-language rationale | M |
| FR-AI4 | The system shows model provenance: algorithm, version, training sample count, validation error vs raw NWP, and features used (explainability) | M |
| FR-AI5 | When no model can be trained (no history, upstream down) the system falls back to climatology and labels it so; the Home page never depends on the AI service being up | M |
| FR-AI6 | Models are retrained automatically (nightly) and on demand per location | S |
| FR-AI7 | Hazard probabilities feed region notifications (FR-N4) | M |

### 6.7 Mobile app and region-based notifications

| ID | Requirement | Pri |
|---|---|---|
| FR-N1 | Users can install a mobile app (iOS/Android) that shows the Today, AI forecast and Alerts views for their regions | M |
| FR-N2 | Users subscribe to one or more **regions** (aimag / province / city) or enable "follow my location", in which case the nearest region is chosen from the device's last known position | M |
| FR-N3 | Users receive a push notification when a weather danger (advisory or warning, BR-02) starts for a subscribed region | M |
| FR-N4 | Users receive a push notification when the AI hazard probability for a subscribed region exceeds their threshold (default 60 %) | M |
| FR-N5 | Users receive a push notification when air quality reaches their chosen grade (default "bad") | M |
| FR-N6 | Users can opt into a daily briefing at a chosen hour (region local time) | S |
| FR-N7 | Users control alert types, minimum severity, quiet hours and language (en / mn / ko) | M |
| FR-N8 | Notifications deep-link into the relevant region screen; the app keeps a history of the last 50 notifications | M |
| FR-N9 | The same danger is never notified twice to the same device within 24 h (BR-09) | M |
| FR-N10 | Users can send themselves a test notification to verify setup | S |
| FR-N11 | No account is required; the device token is the identity. Deleting the app's registration removes all server-side data for that device | M |

### 6.8 Transparency and degraded operation

| ID | Requirement | Pri |
|---|---|---|
| FR-T1 | Every page shows data-source attribution (Open-Meteo, CC BY 4.0) | M |
| FR-T2 | When data is simulated (`meta.mock`), a visible "Demo data" badge is shown | M |
| FR-T3 | When data is served stale after an upstream error (`meta.stale`), a "Stale" badge is shown | M |
| FR-T4 | A failed card shows an error state with retry and does not break the page | M |

---

## 7. Business rules

**BR-01: Air-quality grades (Korean Ministry of Environment 4-tier, as used by Naver and AirKorea)**

| Grade | PM10 µg/m³ | PM2.5 µg/m³ | Colour | Advice |
|---|---|---|---|---|
| Good | 0–30 | 0–15 | Blue | Outdoor activity OK |
| Moderate | 31–80 | 16–35 | Green | Sensitive groups take care |
| Bad | 81–150 | 36–75 | Orange | Limit prolonged outdoor activity; mask (KF80) |
| Very bad | ≥ 151 | ≥ 76 | Red | Avoid outdoor activity; mask (KF94) |

The overall grade is the **worse** of PM10 and PM2.5. *Rationale:* stricter than the US AQI breakpoints, and matches what Korean users expect. Ulaanbaatar winter PM2.5 frequently exceeds 150 µg/m³, so "very bad" will be common in season, which is correct.

**BR-02: Derived alerts (KMA-style).** Alerts are labelled `source: derived` until official feeds exist.

| Hazard | Advisory | Warning |
|---|---|---|
| Heat wave | Feels-like max ≥ 33 °C for 2 days | ≥ 35 °C |
| Cold wave | Morning min ≤ −12 °C, or a ≥ 10 °C day-over-day drop | Min ≤ −15 °C |
| Heavy rain | ≥ 60 mm / 3 h or ≥ 110 mm / 12 h | ≥ 90 mm / 3 h or ≥ 180 mm / 12 h |
| Heavy snow | ≥ 5 cm / 24 h | ≥ 20 cm / 24 h |
| Strong wind | ≥ 14 m/s or gust ≥ 20 m/s | ≥ 21 m/s or gust ≥ 26 m/s |
| Fine dust | Grade "bad" sustained | Grade "very bad" |

*Note for the Mongolian market:* NAMEM cold-wave criteria differ, because −25 °C is a normal winter day. Phase 2 makes thresholds **per region** (configuration, not code).

**BR-03: Yesterday comparison.** diff = current temp − temp at the same local hour yesterday, rounded to 0.1. If |diff| < 0.5 the message is "Same as yesterday". Otherwise it reads "X° warmer than yesterday" or "X° cooler than yesterday".

**BR-04: Clothing bands (Naver 옷차림 convention)**

| Temp °C | Advice |
|---|---|
| ≥ 28 | Sleeveless, shorts, linen |
| 23–27 | Short sleeves, thin shirts |
| 20–22 | Thin long sleeves, cotton trousers |
| 17–19 | Light knit, hoodie, jeans |
| 12–16 | Jacket, cardigan |
| 9–11 | Trench coat, layered |
| 5–8 | Wool coat, heat-tech, knit |
| ≤ 4 | Padded coat, scarf, gloves |

**BR-05: Life indices.** UV follows WHO bands (0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme). Heat index applies only when T ≥ 27 °C. Wind chill applies only when T ≤ 10 °C and wind > 1.3 m/s. Laundry combines humidity, precipitation probability, wind and sunshine. Car wash looks at precipitation over the next 48 h. Outdoor activity combines air grade, precipitation and temperature comfort.

**BR-06: Model agreement.** Spread is the max − min of the daily maximum temperature across the selected models. Agreement is **high** if spread < 2 °C, **medium** if < 4 °C, and **low** otherwise.

**BR-07: AM/PM split.** AM covers 00:00–11:59 local time and PM covers 12:00–23:59. The representative condition is the most severe one in the window. Precipitation probability is the window maximum.

**BR-08: Freshness.** Current and hourly data are cached for 10 minutes, air quality for 30 minutes, model comparison for 60 minutes, AI predictions for 30 minutes and geocoding for 24 hours. When the upstream fails, the last good value is served for up to 6 hours, flagged as stale.

**BR-09: Notification dedup and etiquette.** One notification per (device, region, kind, hazard-or-grade, local day). Quiet hours (default none; typical 22:00–07:00 region local time) suppress everything except *warnings* (경보). An advisory that upgrades to a warning is a new event. Daily briefings are sent once per local day at the chosen hour ± 10 min.

**BR-10: Region assignment.** A device with `followLocation` is assigned to the nearest region centre by great-circle distance, re-evaluated when the app reports a new position more than 25 km from the last one. Explicit region subscriptions are kept alongside.

**BR-11: AI risk notification.** Triggered when `HazardRisk.probability ≥ preferences.aiRiskThreshold` for a subscribed region, with the hazard's severity. The message always states the probability ("72 % chance") and that it is an AI estimate, never as a confirmed warning.
---

## 8. User stories (MVP backlog)

| ID | As a… | I want… | So that… | Acceptance criteria (Given / When / Then) |
|---|---|---|---|---|
| US-01 | Commuter | to see whether it will rain at 18:00 | I take an umbrella | Given a location, when I open Home, then the hourly strip shows precipitation % and mm for each of the next 48 hours, with the current hour first |
| US-02 | Parent | to know if PM2.5 is safe | I decide on outdoor play | Given air data, then the current card shows the PM2.5 grade chip in the BR-01 colour, and the Air page shows the 72 h trend |
| US-03 | Any user | to know if today is warmer than yesterday | I dress right | The current card shows a BR-03 sentence and a BR-04 clothing card |
| US-04 | Driver | to see strong wind or snow warnings | I plan the route | When the forecast exceeds BR-02 thresholds, an alert banner appears with severity colour and its time window |
| US-05 | Enthusiast | to compare ECMWF with GFS | I judge confidence | The Compare page lists the selected models, and each day shows an agreement badge per BR-06 |
| US-06 | Returning user | my favourite cities one tap away | I check quickly | Starring adds the city to favourites; after a reload it is still listed |
| US-07 | Any user | to share a link to Seoul's weather | a friend sees the same | The URL contains lat, lon and name, and opening it renders the same location |
| US-08 | Mobile user | the page to work on a 360 px phone | I can read it on the bus | No horizontal page scroll (the hourly strip excepted), and tap targets are ≥ 44 px |
| US-09 | Any user | to see the map of the country | I see which cities are coldest | The Map shows region markers with temperature; clicking one opens Home for that city |
| US-10 | Any user | to know when data is not live | I'm not misled | When `meta.mock` is true a "Demo data" badge is visible; when stale, a "Stale" badge |
| US-11 | Herder / driver | a push alert when a cold wave or strong wind is likely in my aimag | I move livestock or delay the trip | Given a device subscribed to "mn-khovd", when the derived alert or AI risk crosses the threshold, then one push arrives within 10 min with title, severity, time window and a deep link; a second evaluation 10 min later sends nothing (BR-09) |
| US-12 | Parent | a morning push with today's PM2.5 and outfit advice | I prepare the kids | Given dailyBriefingHour = 7, then a briefing arrives at 07:00 ± 10 min region time containing min/max, PM2.5 grade and clothing summary |
| US-13 | Enthusiast | to see what the AI changed vs the raw model and how sure it is | I trust (or not) the forecast | The AI card shows the adjusted line, the raw NWP dashed line, a shaded P10–P90 band and the model's validation MAE vs raw |
| US-14 | Traveller | alerts to follow me | I don't manage regions | With "follow my location" on, the nearest region is picked (BR-10) and shown in Settings |

### 8.1 Why AI post-processing rather than a "weather foundation model"

Naver, like KMA and ECMWF, presents **NWP output post-processed with statistics/ML** (MOS, bias correction, ensemble blending). That is where machine learning demonstrably improves consumer forecasts today: 10–30 % lower temperature error at 1–3 day lead times, and better-calibrated precipitation probabilities. Training a global foundation model (GraphCast, Pangu-Weather) needs ERA5-scale data and GPUs and is out of reach for an MVP. The module is therefore scoped to: per-location **bias correction**, **ensemble blending** with learned weights, **calibrated probabilities** and **hazard risk estimation**, with explicit explainability (FR-AI4). The architecture leaves room to swap in a learned global model later behind the same `/predict` contract.

---

## 9. Non-functional requirements (business view)

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | API p95 ≤ 300 ms on cache hit and ≤ 1.5 s on cache miss. Home JS bundle ≤ 250 KB gzipped (the Map page is lazy-loaded) |
| NFR-02 | Availability | 99.5 % monthly. Upstream outages degrade to stale or mock data, never a blank page |
| NFR-03 | Scalability | Horizontally scalable stateless API. Shared cache (Redis) in production |
| NFR-04 | Security | Input validation, rate limiting (120 req/min/IP), CORS allow-list, no PII stored server-side in the MVP, HTTPS only, non-root containers |
| NFR-05 | Privacy | Geolocation used only client-side to request weather. Not stored server-side. Favourites stay on the device |
| NFR-06 | Accessibility | WCAG 2.1 AA: contrast, keyboard navigation, ARIA labels on icons, never colour alone (grades also carry text labels) |
| NFR-07 | Compliance | Open-Meteo CC BY 4.0 attribution on every page. Respect fair-use limits (< 10k calls/day on the free tier, so caching is mandatory; commercial tier before monetisation) |
| NFR-08 | Observability | Structured logs, cache hit ratio, upstream error rate, health endpoint |
| NFR-09 | Maintainability | Typed contract shared by frontend and backend. Domain rules are pure functions with unit tests |

---

## 10. Data sources and licensing

| Source | Data | Licence / cost | MVP use |
|---|---|---|---|
| Open-Meteo Forecast API | Current, hourly, daily, multi-model | CC BY 4.0, free non-commercial (< 10k calls/day); paid for commercial use | Primary |
| Open-Meteo Air Quality (CAMS) | PM10, PM2.5, gases, AQI | CC BY 4.0 | Primary |
| Open-Meteo Geocoding (GeoNames) | Place search | CC BY 4.0 | Primary |
| OpenStreetMap tiles | Base map | ODbL; tile usage policy (switch to a commercial tile CDN at scale) | Map |
| NAMEM (Mongolia) | Official forecast and warnings | Partnership / API agreement required | Phase 2 |
| KMA Open API (data.go.kr) | Official KR forecast and warnings | Free with API key | Phase 2 |
| AirKorea | Station PM data (KR) | Free with API key | Phase 2 |

---

## 11. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Upstream quota or outage (already observed: Open-Meteo returned HTTP 429 from a shared IP during development) | High | High | Cache with single-flight, stale-while-error, labelled mock fallback, paid tier before launch, multi-provider adapters |
| Model data differs from official warnings, harming trust | Medium | High | Label alerts "derived", attribute provider, prioritise official adapters in Phase 2 |
| Air-quality model underestimates local smog (UB ger districts) | Medium | High | Add station-based sources (AirVisual, UB city monitoring) in Phase 2; show "model estimate" note |
| Map tile policy violation at scale | Medium | Medium | Commercial tile provider or self-hosted tiles before marketing push |
| Scope creep toward Naver's full feature set | High | Medium | MoSCoW backlog; phase gates tied to KPIs |
| AI risk notifications create false alarms and alert fatigue | Medium | High | Default threshold 60 %, probability always stated, dedup (BR-09), user-tunable; monitor opt-out rate as a KPI |
| AI model trained on synthetic/fallback data in degraded mode | Medium | Medium | `ModelInfo.algorithm = climatology-fallback` and `trainingSamples = 0` are surfaced in the UI; no notification is sent from fallback models |
| Push delivery dependence on Expo/APNs/FCM | Low | Medium | Expo Push abstraction behind a `PushSender` port; direct FCM/APNs adapter later; delivery receipts monitored |
| Location privacy on mobile | Medium | High | Foreground-only location, only the last position (rounded) is stored, deletable via DELETE /devices/:id; no account |

---

## 12. Glossary

| Term | Meaning |
|---|---|
| NWP | Numerical weather prediction (ECMWF, GFS, ICON, …) |
| PM10 / PM2.5 | Particulate matter ≤ 10 / ≤ 2.5 µm (미세먼지 / 초미세먼지) |
| 특보 (Advisory / Warning) | KMA special weather report; 주의보 = advisory, 경보 = warning |
| BFF | Backend-for-Frontend: an API shaped to one UI's needs |
| KMA / NAMEM | Korea Meteorological Administration / National Agency for Meteorology and Environmental Monitoring (Mongolia) |
| WMO code | Standard present-weather code (0–99) used to derive conditions |
