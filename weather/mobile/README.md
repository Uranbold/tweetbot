# Skycast mobile (Expo)

The notification client for Skycast: pick regions (aimags / provinces / cities) or follow your GPS
position, and receive push notifications about weather danger (advisories / warnings), AI-predicted
hazard risks, bad air quality and an optional daily briefing — plus a compact Naver-style weather view.

Stack: Expo SDK 57 (managed), expo-router, TanStack Query, expo-notifications, expo-location,
react-native-svg, AsyncStorage. Types come from `../shared/contract.ts` (type-only imports).

## Run

```bash
cd weather/mobile
npm install
npm start                 # Expo dev server → scan the QR code with Expo Go
npm run start:fixtures    # same, with EXPO_PUBLIC_USE_FIXTURES=1 (no backend needed)
npm run web               # web preview in the browser
```

Point the app at a backend with `EXPO_PUBLIC_API_URL` (default `http://localhost:8787/api/v1`; see
`.env.example`). On the Android emulator use `http://10.0.2.2:8787/api/v1`; on a physical phone use
your machine's LAN IP.

Verification used in CI:

```bash
npm install && npx tsc --noEmit && npx jest --ci && npx expo export --platform web
```

## How push works end to end

1. **App start** — `NotificationsProvider` creates the Android channels (`weather-alerts`, importance
   MAX, custom vibration; `daily-briefing`, importance DEFAULT), checks/requests the OS permission,
   and resolves the Expo push token via `getExpoPushTokenAsync({ projectId })`. The project id comes
   from `app.json → extra.eas.projectId` (or the EAS manifest). When it is missing, or on web / a
   simulator / Expo Go, the app uses a dev placeholder `ExponentPushToken[dev-<model>-<installId>]`
   so the registration flow still runs.
2. **Register** — the device store (`src/store`) builds a `DeviceRegistration` (token, platform,
   regionIds, followLocation, lastLocation, preferences, appVersion) and calls `POST /devices`
   (upsert by `pushToken`). The returned `Device.id` is persisted in AsyncStorage together with the
   acknowledged registration.
3. **Edit** — every change in Settings (regions, follow-location, preferences) is debounced 600 ms and
   sent as `PATCH /devices/:id`. A 404 (backend restarted) falls back to re-registering. On the next
   app start the stored registration is compared with the current one and re-synced if it drifted.
4. **Dispatch** — the backend job evaluates alerts, AI risks and air grades per region every 10 min,
   dedups by `dedupKey`, respects quiet hours and preferences, and sends through the Expo Push API.
5. **Receive** — foreground notifications show an in-app banner (`ForegroundNotice`); taps (foreground,
   background and cold start) are routed by `parseDeepLink` to the region screen. A background task
   stub (`src/notifications/background.ts`) is registered for data-only pushes.
6. **History / test** — the Alerts tab lists `GET /devices/:id/notifications` and offers
   `POST /devices/:id/test-notification`. Settings also has a "Schedule local test alert in 5 s" button
   that uses `scheduleNotificationAsync`, so the tap → deep-link path can be exercised with no server.

## Deep links

Scheme `skycast://` (also `exp://…/--/…` in Expo Go):

| Link | Screen |
|---|---|
| `skycast://region/<id>` | Region detail, weather tab |
| `skycast://region/<id>/alerts` | Region detail, alerts tab |
| `skycast://alerts`, `skycast://ai`, `skycast://settings` | Tabs |

Test on a device: `npx uri-scheme open "skycast://region/mn-ulaanbaatar/alerts" --android`.

## Project layout

```
app/                     expo-router routes: (tabs)/{index,ai,alerts,settings}, region/[id], _layout
src/api                  typed client (unwraps {data, meta}, maps errors) + react-query hooks
src/store                device registration + preferences reducer, AsyncStorage persistence, provider
src/notifications        channels, permission/token, foreground handler, deep-link routing, local alerts
src/components           WeatherIcon (SVG, ConditionKey × day/night), GradeChip + GradeFace, AlertBanner,
                         RangeBar, HourlyStrip, DailyList, RiskCard, TempBandChart, settings controls
src/lib                  wall-clock time formatting, wind direction, range-bar math, deep-link parser
src/theme                design tokens from docs/UX.md (light + dark), Manrope type scale
src/i18n                 en / mn / ko UI dictionaries
src/__fixtures__         typed fixtures + request handler used by tests and EXPO_PUBLIC_USE_FIXTURES=1
```

## Design

Follows `weather/docs/UX.md`: token-only colours (no literals in components), Manrope 400/500/600/800
via `@expo-google-fonts/manrope` with system fallback, 64 px / 800 hero temperature with tabular
numerals, 4 px grid, 16 px card radius, air grades always shown with a face glyph **and** a label,
warning banners with a 4 px stripe, AI values labelled "AI estimate · NN %", reduced motion honoured,
screen-reader announcements on location load and autosave.

## Limitations

- Real Expo push tokens need a physical device and an EAS `projectId` (`eas init` fills
  `extra.eas.projectId`). Without them the app registers with a dev placeholder token that the
  Expo Push API will reject — fine for exercising the API and the UI, not for actual delivery.
- Expo Go on Android (SDK 53+) no longer supports remote push; use a development build (`eas build
  --profile development`).
- Web export works (notifications and location are platform-guarded), but web push is not implemented.
- Background location is intentionally not requested; "Follow my location" takes one foreground fix per
  session and stores it as `lastLocation` for the backend to pick the nearest region.
