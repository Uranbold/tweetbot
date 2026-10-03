# Skycast: UX & Design System (UX)

| | |
|---|---|
| Document | Interaction design, visual design system, UX laws applied |
| Version | 1.0 |
| Date | 2026-10-01 |
| Applies to | `weather/frontend` (web), `weather/mobile` (Expo). Tokens are shared by name. |
| Inputs | [BA.md](./BA.md) personas & requirements, [SA.md](./SA.md) components |

The product is a **glance UI**: it is scanned and operated, not read. Every rule below serves one goal, stated in the BA: *one glance, one decision.*

---

## 1. Design principles

1. **Answer first, evidence second.** The first card answers "how is it right now and what do I do?" (temperature, condition, yesterday delta, air grade, outfit). Charts and tables come after, as evidence.
2. **State is shape, not only colour.** Every grade, severity and status carries a text label and a glyph in addition to its colour. Colour is never the sole channel.
3. **Numbers are typography.** Temperatures, percentages and times set in tabular figures, aligned, with consistent precision (temperature 0 dp on cards, 1 dp in comparison text; wind 1 dp; precipitation 1 dp; PM integers).
4. **Honest data.** Stale, demo and AI-derived values are visibly labelled where they appear, not in a footer only.
5. **Both themes designed.** Dark is a selected palette, not an inversion. Charts, grades and the accent are re-stepped for the dark surface.
6. **Mongolian and Korean are first-class.** Type stacks include Cyrillic and Hangul faces; labels have room to grow 40 % (Mongolian is long).

---

## 2. UX laws applied (Laws of UX → concrete decisions)

| Law | What it says | Where Skycast applies it |
|---|---|---|
| **Jakob's law** | Users expect your site to work like the ones they know | Information architecture copies Naver Weather: Home · Compare · Air · Map tabs, card order, AM/PM weekly rows, 4-tier dust grades with face glyphs. Mobile uses standard bottom tabs. |
| **Fitts's law** | Targets should be big and close | Tap targets ≥ 44 × 44 px (mobile) / ≥ 32 px (web pointer). Primary actions (search, favourite star, region toggle) at the top edge within thumb reach on mobile; the "use my location" button sits next to search, not in a menu. |
| **Hick's law** | More choices → slower decisions | Home shows at most 8 cards; the hourly card exposes 4 metric tabs (Temp · Rain · Humidity · Wind), not Naver's 9. Compare pre-selects 3 models (ECMWF, GFS, ICON); the rest are behind "More models". Settings groups preferences into 3 sections with sensible defaults so nothing *must* be configured. |
| **Miller's law** | ~7 ± 2 chunks in working memory | Hourly strip is chunked by day with a sticky day label; the weekly list shows 7 days above the fold with "+3 days" expandable; life indices are capped at 8 chips in two rows of 4. |
| **Doherty threshold** | Respond in < 400 ms to keep flow | Skeletons appear instantly per card; react-query keeps the previous location's data on screen while the next loads (`keepPreviousData`); server cache hits return in < 300 ms (NFR-01). Search results show after 150 ms debounce from a cached geocoder. |
| **Aesthetic–usability effect** | Pleasing design is perceived as more usable | One considered palette, a real type pairing, consistent 4 px spacing grid, restrained motion. No gradients-on-everything. |
| **Von Restorff (isolation) effect** | The different item is remembered | Exactly one element may be loud per view: an active **warning** banner (red stripe) outranks everything; absent a warning, the current temperature is the loudest element. Grade chips and badges are quiet (tinted background, dark text). |
| **Law of proximity / common region** | Nearby or enclosed items are perceived as a group | Card = one question. Label/value pairs sit within 4 px of each other and 16 px from the next pair. Cards use a single border radius and padding; sub-groups inside a card use spacing, not nested cards. |
| **Law of similarity** | Similar-looking items are perceived as related | All grade chips share one chip component; all severity banners share one banner component; all charts share one axis/grid/tooltip style. |
| **Serial position effect** | First and last items are remembered | Home order: current conditions first, nationwide grid last (the "where else" question). Mobile tab order: Today first, Settings last. |
| **Peak–end rule** | Experiences are judged by the peak and the end | The "peak" is the clothing/advice line that makes the forecast personal; the "end" of the mobile notification flow is a deep link that lands exactly on the region's alert, not the Home screen. |
| **Zeigarnik effect** | Incomplete tasks stay in mind | Mobile onboarding shows a 3-step progress strip (Allow notifications → Pick regions → Done) and a persistent "Notifications off" chip until enabled. |
| **Tesler's law** | Complexity must live somewhere | Derived indices, grades, alerts, AI uncertainty and dedup live in the backend; the UI shows conclusions and offers the evidence on tap (model info, thresholds). |
| **Postel's law** | Be liberal in what you accept | Search accepts Latin, Cyrillic and Hangul, with or without diacritics; coordinates pasted as "47.92, 106.92" resolve directly; URLs tolerate missing `name`. |
| **Goal-gradient effect** | Motivation rises near completion | Settings shows "2 of 3 set up" and the test-notification button appears as the final step. |
| **Occam's razor** | Prefer the simplest design that works | No dual-axis charts; one y-scale per chart. No carousel for the weekly list. |
| **Pareto principle** | 80 % of use is 20 % of features | Current card + hourly + weekly + air chip cover most visits; everything else is below or in other tabs. |

---

## 3. Visual identity

### 3.1 Concept

*A clear sky over a cold country.* Cool, slightly blue-biased neutrals (never pure grey), a single confident accent, big calm numerals. The one aesthetic risk: temperatures are set in an extra-tight, heavy display weight so the number itself is the hero graphic, with the condition icon drawn in two-tone line style at the same visual weight.

### 3.2 Colour tokens

All colours are tokens on `:root` (web) / `theme.ts` (mobile). Dark values are **selected**, not inverted. Grey ramp is hue-biased toward the accent's complement (sky blue) so neutrals look chosen.

| Token | Role | Light | Dark |
|---|---|---|---|
| `--bg` | page ground | `#f3f5f8` | `#0f1216` |
| `--surface` | card | `#ffffff` | `#171b21` |
| `--surface-2` | inset / chip ground | `#eaeef3` | `#1f252d` |
| `--border` | hairline | `#dde3ea` | `#2a323c` |
| `--fg` | primary text | `#121821` | `#f2f5f8` |
| `--fg-2` | secondary text | `#4b5563` | `#aab4c0` |
| `--fg-3` | muted / axis | `#7b8794` | `#76828f` |
| `--accent` | brand green (Naver cue), buttons, active tab, "now" marker | `#03a84e` | `#2fd072` |
| `--accent-ink` | text on accent | `#ffffff` | `#06240f` |
| `--accent-tint` | selected background | `#e3f7ea` | `#12331f` |
| `--focus` | focus ring | `#2a78d6` | `#6fa8f0` |

Contrast: `--fg` on `--surface` ≥ 15:1 both themes; `--fg-2` ≥ 7:1; `--fg-3` ≥ 4.5:1 (used for text ≥ 12 px only); `--accent-ink` on `--accent` ≥ 4.5:1.

### 3.3 Semantic (status) colours — never colour alone

Status colours are reserved; they are never reused as chart series. Each ships with a **text label and a glyph**.

**Air-quality grade** (Korean MoE convention, kept for Jakob's law; the green↔orange pair is indistinguishable for protan viewers, so the glyph and label are mandatory):

| Grade | Label (en / mn / ko) | Glyph | Light | Dark |
|---|---|---|---|---|
| good | Good / Сайн / 좋음 | ☺ (smiling face) | `#2a78d6` | `#4a90e8` |
| moderate | Moderate / Дунд / 보통 | 😐 (neutral face) | `#1a9e4b` | `#3fb760` |
| bad | Bad / Муу / 나쁨 | 😷 (mask face) | `#e0860a` | `#e89a2a` |
| very-bad | Very bad / Маш муу / 매우나쁨 | ☹ (frowning face) | `#c7322e` | `#e05a52` |

Faces are drawn as inline SVG (not emoji) so they render identically everywhere; this is also Naver's own convention for dust grades. Chips use the grade colour as a tinted background (12 % alpha) with `--fg` text and the solid colour only as a 6 px leading dot or the face.

**Alert severity:** advisory (주의보) `#b26a00` / dark `#e0a430`, label "Advisory", glyph ▲; warning (경보) `#c7322e` / dark `#e05a52`, label "Warning", glyph ⚠ in a filled badge. Warning banners add a 4 px left stripe; advisories do not (Von Restorff).

**Index levels** (`very-low … very-high`) use a 5-step single-hue sequential ramp of the accent, with the level word always printed.

### 3.4 Chart palette (validated with the dataviz validator, both modes)

Categorical, fixed order, used only for multi-model comparison; models keep their slot regardless of selection (colour follows the entity, not the rank):

| Slot | Model | Light | Dark |
|---|---|---|---|
| 1 | ECMWF | `#2a78d6` | `#3987e5` |
| 2 | GFS | `#eb6834` | `#d95926` |
| 3 | ICON | `#1baf7a` | `#199e70` |
| 4 | JMA | `#eda100` | `#c98500` |
| 5 | KMA | `#e87ba4` | `#d55181` |
| 6 | GEM | `#008300` | `#008300` |
| 7 | Météo-France | `#4a3aa7` | `#9085e9` |

Validator result: all hard checks pass in both modes (worst adjacent CVD ΔE 9.1 light / 8.4 dark; normal-vision ΔE 19.6 / 19.3). Light-mode slots 3–5 are below 3:1 on the surface, so **direct labels at line ends and a legend are required** (relief rule). Scatter-style forms are capped at 3 series.

Single-series charts (hourly temperature, PM trend) use `--fg` for the line and the accent only for the "now" marker; the AI card uses `--fg` for the AI line, `--fg-3` dashed for raw NWP, and a 14 % accent band for P10–P90. PM bars are coloured by grade (status colours) with the grade label on hover and a table view toggle.

### 3.5 Typography

| Role | Face | Fallback stack | Notes |
|---|---|---|---|
| Display numerals (current temp, hero numbers) | **Manrope 800** | `"Noto Sans KR", "Noto Sans", system-ui, sans-serif` | `letter-spacing: -0.04em`, `font-variant-numeric: tabular-nums` |
| UI / body | **Manrope 400–600** | same | 15 px base web, 16 px mobile; line-height 1.45 |
| Data labels / axes | **Manrope 500** | same | 12 px, `tabular-nums`, `--fg-3` |
| Uppercase eyebrows | Manrope 600 | same | 11 px, `letter-spacing: 0.08em` |

Manrope covers Latin and Cyrillic (Mongolian); **Noto Sans KR** is loaded only when locale is `ko`. Headings use `text-wrap: balance`. Running text ≤ 65 ch.

Type scale (web): 12 · 13 · 15 · 17 · 20 · 24 · 32 · 56 (hero temp) · 72 (hero temp ≥ 1024 px). Mobile: 12 · 14 · 16 · 18 · 22 · 28 · 64.

### 3.6 Spacing, radius, elevation

* 4 px base grid: 4 · 8 · 12 · 16 · 24 · 32 · 48.
* Card padding 16 px (mobile) / 20 px (desktop); card gap 12 px; section gap 24 px.
* Radius: cards 16 px, chips 999 px, buttons 10 px, inputs 10 px. One radius per role, used everywhere.
* Elevation: cards are flat with `--border` hairline on the light theme and no border, slightly lighter surface on dark. Only the floating search results panel and the mobile bottom sheet get a shadow (`0 8px 24px rgba(10,20,40,.12)`).
* Layout: mobile single column, max content width 680 px; desktop ≥ 1024 px two columns (main 2fr, aside 1fr with air, sun, nation); ≥ 1440 px content max 1200 px. Side gutter 16 px minimum at every width. Only the hourly strip scrolls horizontally.

### 3.7 Iconography

Hand-drawn inline SVG set, 24 px grid, 1.75 px stroke, two tones (`currentColor` + accent for sun/warm, `--focus` blue for rain/cold). Keyed by `ConditionKey` with day/night variants. Every icon has an accessible name (`<title>`), and condition text always appears next to the icon on cards.

### 3.8 Motion

* Durations 120 ms (hover), 200 ms (card enter), 320 ms (sheet). Easing `cubic-bezier(.2,.8,.2,1)`.
* One orchestrated moment: on location change, the hero temperature counts to the new value over 320 ms and cards fade in 40 ms apart. Nothing else animates on load.
* `prefers-reduced-motion`: all transitions reduced to opacity only.

---

## 4. Component specifications

### 4.1 Current card (hero)
* Grid: left column temperature (display numerals, degree sign in `--fg-2`), right column icon + condition label; below: a single line "2.3° warmer than yesterday" in `--fg-2` with an up/down glyph; a row of 4 label/value pairs (Feels like · Humidity · Wind · UV) on one baseline; a chip row (PM10 grade, PM2.5 grade, Sunrise, Sunset).
* Headline sentence in 17 px below the chip row.
* States: skeleton (same geometry), stale (small "Updated 14:10 · stale" line), demo (badge "Demo data" top-right in `--surface-2`).

### 4.2 Alert banner
* Appears only when `alerts.length > 0`; stacks ≤ 2, the rest summarised "+1 more".
* Warning: 4 px left stripe, filled glyph badge, title 15/600, time window in `--fg-2`. Advisory: outline glyph, no stripe.
* Tap → expands the description (threshold rationale). Dismiss is not offered (safety information).

### 4.3 Hourly strip
* Horizontal scroll with `scroll-snap-type: x mandatory`; each hour column 56 px wide; sticky day label at the top-left of each day segment ("Today", "Tomorrow", "Fri 3").
* Rows: time → icon → temperature line (SVG path, 2 px, area fill 8 % `--fg`) → metric row for the active tab (precip % as text + 4 px rounded bars anchored to baseline; humidity %; wind m/s with direction arrow).
* "Now" column: accent 2 px vertical rule and accent time label.
* Hover/tap: crosshair + tooltip with all metrics for that hour; keyboard ← → moves the crosshair.
* Tabs: segmented control, 4 options, `aria-pressed`, swipe not required.

### 4.4 Weekly list
* Row: day + date (left, 56 px), AM icon + %, PM icon + %, min temp, range bar, max temp. Range bar scaled to the 10-day min/max; today's bar carries a dot at the current temperature.
* First 7 rows visible; "Show 10 days" reveals the rest (Miller).
* Row tap → highlights that day in the hourly strip (shared selection state).

### 4.5 Grade chip / gauge
* Chip: face glyph (16 px) + label + value ("PM2.5 · Bad · 48"). Tinted ground, `--fg` text.
* Gauge (Air page): 180° arc with 4 grade segments separated by 2 px gaps; needle at current value; value in display numerals; label and face under it; legend built from `AirQualityReport.scale` with threshold numbers printed.

### 4.6 AI forecast card
* Header "AI forecast" with a `?` affordance opening the ModelInfo popover (algorithm, version, samples, MAE vs raw, features).
* Summary sentence first (the answer), then ≤ 3 risk rows: hazard glyph + name, probability bar (8 px, severity colour at 100 % alpha for the filled part, 12 % for the track) with the percentage printed, expected start.
* Chart: AI temperature line (`--fg`, 2 px), P10–P90 band (accent 14 %), raw NWP dashed (`--fg-3`); legend inline above the chart; crosshair tooltip shows all three values.
* Fallback states: "AI forecast unavailable" (quiet, retry link) and "Climatology estimate" badge when `model.algorithm === 'climatology-fallback'`. Never a loud error.

### 4.7 Search
* Input with leading search glyph, trailing "use my location" button (44 px). Results list appears after 150 ms debounce; max 8 items; each row name · admin1 · country with a star to favourite inline.
* Keyboard: ↓↑ move, Enter selects, Esc closes, Tab leaves. `role="combobox"` + `aria-activedescendant`.
* Recent (≤ 5) and Favourites sections appear when the field is empty and focused.

### 4.8 Region picker (mobile)
* Grouped list by country with sticky headers; search filter at top; checkbox rows 56 px tall; selected count in the header; "Follow my location" is a switch at the very top with the resolved nearest region shown beneath it.

### 4.9 Notification settings (mobile)
* Three sections: *What* (alert types as chips, min severity segmented, AI risk threshold stepper 40–90 % in 10 % steps, air grade threshold), *When* (daily briefing hour picker / off, quiet hours), *Language*.
* Each change saves automatically (debounced 600 ms) with a subtle "Saved" check next to the section title; no Save button (Tesler: the system carries the burden).
* Status row at top: "Notifications: On" (accent) or "Off — enable in Settings" (advisory colour) with a button that opens OS settings.
* Setup progress strip "1 of 3" until permission, ≥ 1 region and a successful test notification exist (Zeigarnik, Goal-gradient).

### 4.10 Push notification content
* Title ≤ 40 chars: "⚠ Cold-wave warning · Khovd". Body ≤ 110 chars: "Min −18 °C expected Thu 06:00–09:00. Dress in layers; limit time outside." AI risk: "72 % chance of a strong-wind advisory Fri (AI estimate)". Always a deep link.
* Android channel "Weather alerts" (max importance) and "Daily briefing" (default importance) so users can silence briefings without losing warnings.

---

## 5. Accessibility checklist (WCAG 2.1 AA)

- [ ] Every colour-coded state has a text label and a glyph (grades, severities, index levels, model lines with direct labels).
- [ ] Text contrast ≥ 4.5:1; large display numerals ≥ 3:1; focus ring 2 px `--focus` with 2 px offset on every interactive element.
- [ ] All icons have accessible names; decorative SVGs are `aria-hidden`.
- [ ] Hourly and model charts have a "Table view" toggle rendering the same data as a `<table>`.
- [ ] Search is a proper combobox; tabs are `role="tablist"`; the hourly metric control is a `role="group"` of toggle buttons.
- [ ] Touch targets ≥ 44 px on mobile; pointer targets ≥ 32 px with ≥ 8 px spacing on web.
- [ ] `prefers-reduced-motion` and `prefers-color-scheme` honoured; theme toggle persists.
- [ ] Content reflows to 320 px without horizontal page scroll; the hourly strip announces "scrollable" and supports keyboard arrows.
- [ ] Live-region (`aria-live="polite"`) announces "Loaded weather for Seoul" on location change and "Saved" on settings changes.
- [ ] Language attribute switches with locale (`lang="mn"`, `lang="ko"`).

---

## 6. Copywriting rules

* Lead with the decision: "Take an umbrella after 6 PM" before "60 % chance of rain".
* Plain, active, specific. "Saved" not "Your preferences have been successfully updated".
* Errors say what happened and what to do: "Can't reach the forecast service. Showing data from 14:10. Retry".
* AI language is always probabilistic and labelled: "AI estimate · 72 %". Never "will".
* Units always attached to numbers: 12°, 4.5 m/s, 48 µg/m³. Degree sign without "C" on cards; "°C" in tables.

---

## 7. Review gate (definition of done for UI work)

A screen is done when: it matches the token table (no literal colours in components), both themes are screenshot-checked at 390 px and 1280 px, every status has label + glyph, the chart palette passed the validator, keyboard navigation works end to end, skeleton/error/stale/demo states exist, and copy follows §6.
