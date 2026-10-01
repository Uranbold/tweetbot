# Skycast — frontend

React 18 + TypeScript + Vite web client for the Skycast weather API, modelled on
weather.naver.com (Home · Compare · Air quality · Map) and styled to
[`../docs/UX.md`](../docs/UX.md). Types come from the shared contract
`../shared/contract.ts` (type-only imports via the `@contract` alias; the file is never bundled).

## Run

```bash
npm install
npm run dev            # http://localhost:5173, proxies /api → http://localhost:8787
npm run dev:fixtures   # same, but the API client answers from src/__fixtures__ (no backend)
npm run build          # tsc -b && vite build → dist/
npm run preview        # serve dist/ on :4173 (also proxies /api)
npm run typecheck
npm test               # vitest + Testing Library (jsdom)
```

`SKYCAST_API_URL=http://host:port npm run dev` points the dev/preview proxy at another backend.

### Fixture mode

`VITE_USE_FIXTURES=1` compiles a `__USE_FIXTURES__` flag so `src/api/client.ts` serves
deterministic, contract-shaped JSON from `src/__fixtures__/` (including a simulated
`/predict`). In normal builds that branch is dead code and the fixtures are not bundled.
Regenerate the JSON with `node scripts/generate-fixtures.mjs`. `npm run build:fixtures`
writes a fixture-only bundle to `dist-fixtures/` for visual checks.

## Docker

The image is built from the `weather/` directory so the shared contract is in context:

```bash
cd weather
docker build -f frontend/Dockerfile -t skycast-frontend .
docker run --rm -p 8080:80 --network skycast skycast-frontend
```

`nginx.conf` serves the SPA (history fallback to `index.html`, immutable hashed assets) and
proxies `/api/` to `http://backend:8787` — name the backend container `backend` on the same
network, or edit the `upstream`.

## Structure

```
src/
  api/          typed fetch client (ApiRequestError), react-query hooks, query keys
  components/   cards/ (Home cards), charts/ (hand-rolled SVG), common/, icons/, layout/
  pages/        HomePage, AirPage, ComparePage, MapPage (leaflet), NotFoundPage
  hooks/        useLocationState (URL ?lat&lon&name), useFavorites (localStorage),
                useCountUp, useMediaQuery, useAggregateMeta, …
  lib/          formatting (wall-clock times in the location's zone), air grades,
                range-bar maths, model slots, theme, decision line
  styles/       global.css — all colours are tokens on :root, dark values under
                prefers-color-scheme and [data-theme="dark"]
  __fixtures__/ generated JSON + fixture handler (tests, VITE_USE_FIXTURES)
```

State: the selected place lives in the URL (`/?lat=47.92&lon=106.92&name=Ulaanbaatar`,
same params on `/air` and `/compare`; `/compare?models=ecmwf,gfs`, `/map?region=kr&layer=air`).
Favourites, recents and the theme choice persist in `localStorage` (all reads/writes guarded).

## Design notes

- Tokens, type (Manrope), spacing/radius, status colours and the validated chart palette follow
  `docs/UX.md` §3. Grades always carry an inline-SVG face glyph + label, never colour alone.
- Theme toggle (system / light / dark) in the header; `prefers-reduced-motion` reduces all
  motion to opacity.
- Every chart has a table-view toggle, hover crosshair and arrow-key navigation.
- `Demo data` / `Stale` flags render on the card that uses the data and in the footer.
