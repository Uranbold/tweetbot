#!/usr/bin/env node
// Generates deterministic, contract-shaped fixture JSON into src/__fixtures__.
// Run: node scripts/generate-fixtures.mjs   (output is committed; tests and VITE_USE_FIXTURES use it)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../src/__fixtures__/', import.meta.url));
mkdirSync(out, { recursive: true });

let seed = 20261001;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const r1 = (n) => Math.round(n * 10) / 10;
const pad = (n) => String(n).padStart(2, '0');

const META = { provider: 'fixture', fetchedAt: '2026-10-01T06:00:00Z', stale: false, mock: true };

const COND = {
  0: ['clear', 'Clear sky'],
  1: ['mostly-clear', 'Mainly clear'],
  2: ['partly-cloudy', 'Partly cloudy'],
  3: ['cloudy', 'Overcast'],
  45: ['fog', 'Fog'],
  51: ['drizzle', 'Light drizzle'],
  61: ['rain', 'Slight rain'],
  65: ['heavy-rain', 'Heavy rain'],
  66: ['freezing-rain', 'Freezing rain'],
  71: ['snow', 'Slight snow'],
  75: ['heavy-snow', 'Heavy snow'],
  85: ['sleet', 'Snow showers'],
  95: ['thunderstorm', 'Thunderstorm'],
};
const cond = (code, isDay = true) => ({ code, key: COND[code][0], label: COND[code][1], isDay });

const loc = (id, name, admin1, country, countryCode, lat, lon, timezone, utcOffsetSeconds, elevation) => ({
  id: String(id), name, ...(admin1 ? { admin1 } : {}), country, countryCode, lat, lon, timezone, utcOffsetSeconds,
  ...(elevation != null ? { elevation } : {}),
});

const UB = loc(2028462, 'Ulaanbaatar', 'Ulaanbaatar', 'Mongolia', 'MN', 47.92, 106.92, 'Asia/Ulaanbaatar', 28800, 1350);

const MN = [
  [UB, 11.4, 2],
  [loc(2031964, 'Erdenet', 'Orkhon', 'Mongolia', 'MN', 49.03, 104.08, 'Asia/Ulaanbaatar', 28800, 1300), 9.8, 1],
  [loc(2032201, 'Darkhan', 'Darkhan-Uul', 'Mongolia', 'MN', 49.49, 105.92, 'Asia/Ulaanbaatar', 28800, 707), 10.9, 3],
  [loc(2032614, 'Choibalsan', 'Dornod', 'Mongolia', 'MN', 48.07, 114.53, 'Asia/Choibalsan', 28800, 747), 12.6, 0],
  [loc(2030065, 'Mörön', 'Khövsgöl', 'Mongolia', 'MN', 49.64, 100.16, 'Asia/Ulaanbaatar', 28800, 1283), 6.2, 61],
  [loc(1516048, 'Khovd', 'Khovd', 'Mongolia', 'MN', 48.01, 91.64, 'Asia/Hovd', 25200, 1405), 8.1, 1],
  [loc(1515029, 'Ölgii', 'Bayan-Ölgii', 'Mongolia', 'MN', 48.97, 89.96, 'Asia/Hovd', 25200, 1715), 4.7, 71],
  [loc(2032855, 'Bayankhongor', 'Bayankhongor', 'Mongolia', 'MN', 46.19, 100.72, 'Asia/Ulaanbaatar', 28800, 1859), 8.9, 2],
  [loc(2031405, 'Dalanzadgad', 'Ömnögovi', 'Mongolia', 'MN', 43.57, 104.43, 'Asia/Ulaanbaatar', 28800, 1470), 15.3, 0],
  [loc(2029156, 'Sainshand', 'Dornogovi', 'Mongolia', 'MN', 44.89, 110.14, 'Asia/Ulaanbaatar', 28800, 938), 16.0, 0],
  [loc(2032614 + 1, 'Arvaikheer', 'Övörkhangai', 'Mongolia', 'MN', 46.26, 102.78, 'Asia/Ulaanbaatar', 28800, 1913), 9.4, 3],
  [loc(2030474, 'Uliastai', 'Zavkhan', 'Mongolia', 'MN', 47.74, 96.84, 'Asia/Hovd', 25200, 1760), 5.5, 3],
  [loc(2032570, 'Baruun-Urt', 'Sükhbaatar', 'Mongolia', 'MN', 46.68, 113.28, 'Asia/Ulaanbaatar', 28800, 981), 13.2, 1],
  [loc(2028749, 'Tsetserleg', 'Arkhangai', 'Mongolia', 'MN', 47.47, 101.45, 'Asia/Ulaanbaatar', 28800, 1691), 7.6, 51],
];
const KR = [
  [loc(1835848, 'Seoul', 'Seoul', 'South Korea', 'KR', 37.57, 126.98, 'Asia/Seoul', 32400, 38), 22.4, 1],
  [loc(1843564, 'Incheon', 'Incheon', 'South Korea', 'KR', 37.46, 126.71, 'Asia/Seoul', 32400, 10), 21.6, 2],
  [loc(1845136, 'Chuncheon', 'Gangwon', 'South Korea', 'KR', 37.87, 127.73, 'Asia/Seoul', 32400, 77), 20.8, 2],
  [loc(1843137, 'Gangneung', 'Gangwon', 'South Korea', 'KR', 37.75, 128.9, 'Asia/Seoul', 32400, 26), 19.9, 61],
  [loc(1835235, 'Daejeon', 'Daejeon', 'South Korea', 'KR', 36.35, 127.38, 'Asia/Seoul', 32400, 67), 23.1, 1],
  [loc(1845604, 'Cheongju', 'North Chungcheong', 'South Korea', 'KR', 36.64, 127.49, 'Asia/Seoul', 32400, 58), 22.8, 1],
  [loc(1845457, 'Jeonju', 'North Jeolla', 'South Korea', 'KR', 35.82, 127.15, 'Asia/Seoul', 32400, 53), 23.5, 2],
  [loc(1841811, 'Gwangju', 'Gwangju', 'South Korea', 'KR', 35.16, 126.85, 'Asia/Seoul', 32400, 46), 24.0, 3],
  [loc(1835329, 'Daegu', 'Daegu', 'South Korea', 'KR', 35.87, 128.6, 'Asia/Seoul', 32400, 49), 24.6, 0],
  [loc(1838524, 'Busan', 'Busan', 'South Korea', 'KR', 35.1, 129.04, 'Asia/Seoul', 32400, 15), 24.2, 1],
  [loc(1833747, 'Ulsan', 'Ulsan', 'South Korea', 'KR', 35.54, 129.31, 'Asia/Seoul', 32400, 30), 23.4, 2],
  [loc(1846266, 'Jeju', 'Jeju', 'South Korea', 'KR', 33.5, 126.53, 'Asia/Seoul', 32400, 20), 25.1, 61],
];
const WORLD = [
  [loc(1850147, 'Tokyo', 'Tokyo', 'Japan', 'JP', 35.69, 139.69, 'Asia/Tokyo', 32400, 40), 24.8, 2],
  [loc(1816670, 'Beijing', 'Beijing', 'China', 'CN', 39.9, 116.4, 'Asia/Shanghai', 28800, 49), 21.0, 1],
  [loc(1880252, 'Singapore', null, 'Singapore', 'SG', 1.29, 103.85, 'Asia/Singapore', 28800, 15), 30.2, 95],
  [loc(292223, 'Dubai', 'Dubai', 'United Arab Emirates', 'AE', 25.08, 55.31, 'Asia/Dubai', 14400, 5), 36.4, 0],
  [loc(524901, 'Moscow', 'Moscow', 'Russia', 'RU', 55.75, 37.62, 'Europe/Moscow', 10800, 144), 9.3, 3],
  [loc(2643743, 'London', 'England', 'United Kingdom', 'GB', 51.51, -0.13, 'Europe/London', 3600, 25), 14.1, 61],
  [loc(2988507, 'Paris', 'Île-de-France', 'France', 'FR', 48.85, 2.35, 'Europe/Paris', 7200, 42), 16.2, 3],
  [loc(5128581, 'New York', 'New York', 'United States', 'US', 40.71, -74.01, 'America/New_York', -14400, 10), 18.7, 2],
  [loc(5368361, 'Los Angeles', 'California', 'United States', 'US', 34.05, -118.24, 'America/Los_Angeles', -25200, 89), 26.3, 0],
  [loc(2147714, 'Sydney', 'New South Wales', 'Australia', 'AU', -33.87, 151.21, 'Australia/Sydney', 36000, 58), 17.4, 1],
];

const grade = (v, scale) => scale.find((s) => v >= s.min && (s.max == null || v <= s.max)).grade;
const SCALE = {
  pm10: [
    { grade: 'good', min: 0, max: 30 },
    { grade: 'moderate', min: 31, max: 80 },
    { grade: 'bad', min: 81, max: 150 },
    { grade: 'very-bad', min: 151, max: null },
  ],
  pm25: [
    { grade: 'good', min: 0, max: 15 },
    { grade: 'moderate', min: 16, max: 35 },
    { grade: 'bad', min: 36, max: 75 },
    { grade: 'very-bad', min: 76, max: null },
  ],
};
const worse = (a, b) => {
  const order = ['good', 'moderate', 'bad', 'very-bad'];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
};

function nation(region, regionLabel, list) {
  return {
    data: {
      region,
      regionLabel,
      cities: list.map(([location, t, code], i) => {
        const pm10 = Math.round(18 + rand() * (region === 'mn' ? 90 : 70));
        return {
          location,
          temperature: t,
          condition: cond(code, true),
          precipitationProbability: [61, 71, 51, 95].includes(code) ? 60 + Math.round(rand() * 30) : Math.round(rand() * 20),
          temperatureMin: r1(t - 8 - rand() * 4),
          temperatureMax: r1(t + 1 + rand() * 2),
          ...(i % 5 === 4 ? {} : { pm10Grade: grade(pm10, SCALE.pm10) }),
        };
      }),
    },
    meta: META,
  };
}

// ---------------- weather (Ulaanbaatar, now = 2026-10-01T14:00) ----------------
const start = Date.UTC(2026, 9, 1, 14);
const iso = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
};
const isoDate = (ms) => iso(ms).slice(0, 10);

function hourlyTemp(h, dayIdx) {
  // diurnal curve: min ~06:00, max ~15:00; slight cooling trend
  const base = 4.5 - dayIdx * 0.8;
  const amp = 7.5;
  const phase = Math.cos(((h - 15) / 24) * 2 * Math.PI);
  return base + amp * phase;
}

const hourly = [];
for (let i = 0; i < 48; i++) {
  const ms = start + i * 3600e3;
  const h = new Date(ms).getUTCHours();
  const dayIdx = Math.floor((14 + i) / 24);
  const isDay = h >= 7 && h < 19;
  const t = r1(hourlyTemp(h, dayIdx) + (rand() - 0.5) * 0.6);
  // rain band tomorrow afternoon/evening
  const rainy = i >= 26 && i <= 33;
  const code = rainy ? (i >= 29 && i <= 31 ? 61 : 51) : i < 5 ? 1 : i < 12 ? 2 : i < 20 ? 0 : 3;
  const wind = r1(3 + rand() * 4 + (i < 8 ? 3 : 0));
  hourly.push({
    time: iso(ms),
    temperature: t,
    feelsLike: r1(t - wind * 0.6),
    condition: cond(code, isDay),
    precipitationProbability: rainy ? 50 + Math.round(rand() * 40) : Math.round(rand() * 15),
    precipitation: rainy ? r1(0.2 + rand() * (code === 61 ? 2.4 : 0.6)) : 0,
    snowfall: 0,
    humidity: Math.round(rainy ? 75 + rand() * 20 : 30 + rand() * 25 + (isDay ? 0 : 15)),
    windSpeed: wind,
    windDirection: Math.round(290 + rand() * 40),
    uvIndex: isDay ? r1(Math.max(0, 3.6 * Math.sin(((h - 7) / 12) * Math.PI))) : 0,
  });
}

const dailyCodes = [
  [1, 2], [51, 61], [3, 2], [0, 1], [1, 71], [71, 3], [2, 0], [0, 0], [2, 3], [1, 2],
];
const daily = dailyCodes.map(([am, pm], d) => {
  const ms = Date.UTC(2026, 9, 1 + d);
  const tmax = r1([12.1, 8.4, 9.7, 11.9, 6.2, 1.8, 5.5, 8.8, 7.1, 4.3][d]);
  const tmin = r1([-1.6, -0.4, -3.2, -2.1, -4.8, -8.9, -7.3, -4.4, -5.6, -7.9][d]);
  const wet = (c) => [51, 61, 71].includes(c);
  const sr = 7 * 60 + 13 + d; // minutes, later each day
  const ss = 18 * 60 + 52 - 2 * d;
  const hm = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  return {
    date: isoDate(ms),
    temperatureMin: tmin,
    temperatureMax: tmax,
    am: { condition: cond(am, true), precipitationProbability: wet(am) ? 60 : Math.round(rand() * 20) },
    pm: { condition: cond(pm, true), precipitationProbability: wet(pm) ? 70 : Math.round(rand() * 20) },
    precipitationSum: wet(am) || wet(pm) ? r1(1 + rand() * 4) : 0,
    snowfallSum: am === 71 || pm === 71 ? r1(0.5 + rand() * 2) : 0,
    sunrise: `${isoDate(ms)}T${hm(sr)}`,
    sunset: `${isoDate(ms)}T${hm(ss)}`,
    uvIndexMax: r1(3.8 - d * 0.1),
    windSpeedMax: r1(6 + rand() * 6),
  };
});

const airNow = {
  time: '2026-10-01T14:00',
  pm10: 46,
  pm25: 23,
  o3: 62,
  no2: 28,
  so2: 6,
  co: 410,
  pm10Grade: grade(46, SCALE.pm10),
  pm25Grade: grade(23, SCALE.pm25),
  overallGrade: 'moderate',
  usAqi: 74,
};

const cur = hourly[0];
const weather = {
  data: {
    location: UB,
    current: {
      time: cur.time,
      temperature: 11.4,
      feelsLike: 8.9,
      condition: cond(1, true),
      humidity: 34,
      windSpeed: 6.8,
      windGust: 11.2,
      windDirection: 305,
      windDirectionLabel: 'NW',
      precipitation: 0,
      pressure: 1021,
      cloudCover: 18,
      visibility: 24,
      uvIndex: 3.1,
    },
    comparison: { temperatureDiff: 2.3, message: '2.3° warmer than yesterday' },
    today: {
      temperatureMin: daily[0].temperatureMin,
      temperatureMax: daily[0].temperatureMax,
      sunrise: daily[0].sunrise,
      sunset: daily[0].sunset,
      headline: 'Mostly sunny and breezy, light rain likely tomorrow afternoon',
    },
    hourly,
    daily,
    air: airNow,
    lifeIndices: [
      { key: 'uv', label: 'UV index', level: 'moderate', value: 3.6, advice: 'Wear sunglasses around midday' },
      { key: 'laundry', label: 'Laundry', level: 'very-high', value: 88, advice: 'Great day for laundry — dry and windy' },
      { key: 'car-wash', label: 'Car wash', level: 'low', value: 30, advice: 'Rain expected tomorrow, wait a day' },
      { key: 'clothing', label: 'Clothing', level: 'moderate', value: 11, advice: 'Light jacket over long sleeves' },
      { key: 'outdoor-activity', label: 'Outdoor activity', level: 'high', value: 72, advice: 'Good for a walk, mind the wind' },
      { key: 'food-poisoning', label: 'Food poisoning', level: 'very-low', value: 12, advice: 'Low risk in cool weather' },
      { key: 'heat-index', label: 'Heat index', level: 'very-low', value: 10, advice: 'No heat stress expected' },
      { key: 'wind-chill', label: 'Wind chill', level: 'low', value: 8.9, advice: 'Feels cooler in the wind, cover up tonight' },
    ],
    alerts: [
      {
        type: 'strong-wind',
        severity: 'advisory',
        title: 'Strong wind advisory',
        description: 'Gusts above 10 m/s expected until this evening.',
        start: '2026-10-01T12:00',
        end: '2026-10-01T21:00',
        source: 'derived',
      },
    ],
    clothing: { summary: 'Light jacket, long sleeves', items: ['Light jacket', 'Long-sleeve shirt', 'Jeans', 'Sneakers', 'Scarf for the evening'] },
  },
  meta: META,
};

// ---------------- air ----------------
const airHourly = [];
for (let i = 0; i < 72; i++) {
  const ms = start + i * 3600e3;
  const h = new Date(ms).getUTCHours();
  // evening/night stove smoke peak typical for UB
  const peak = h >= 20 || h <= 2 ? 1 : 0;
  const pm10 = Math.round(32 + 22 * Math.sin(i / 7) + peak * (50 + i * 0.6) + rand() * 10);
  const pm25 = Math.round(pm10 * (0.45 + rand() * 0.1));
  airHourly.push({ time: iso(ms), pm10, pm25, o3: Math.round(40 + 30 * Math.sin(((h - 9) / 24) * 2 * Math.PI) + rand() * 6), pm10Grade: grade(pm10, SCALE.pm10), pm25Grade: grade(pm25, SCALE.pm25) });
}
const airDaily = [0, 1, 2, 3].map((d) => {
  const ms = Date.UTC(2026, 9, 1 + d);
  const slice = airHourly.filter((p) => p.time.startsWith(isoDate(ms)));
  const pm10Max = slice.length ? Math.max(...slice.map((p) => p.pm10)) : 140 + d * 10;
  const pm25Max = slice.length ? Math.max(...slice.map((p) => p.pm25)) : 70 + d * 8;
  return { date: isoDate(ms), pm10Grade: grade(pm10Max, SCALE.pm10), pm25Grade: grade(pm25Max, SCALE.pm25), pm10Max, pm25Max };
});
const air = { data: { location: UB, current: airNow, hourly: airHourly, daily: airDaily, scale: SCALE }, meta: META };

// ---------------- compare ----------------
const MODELS = [
  ['ecmwf', 'ECMWF IFS', 'European Centre (EU)', 0, 1],
  ['gfs', 'NOAA GFS', 'NOAA (US)', 1.4, 0.8],
  ['icon', 'DWD ICON', 'Deutscher Wetterdienst (DE)', -0.8, 1.2],
  ['jma', 'JMA GSM', 'Japan Meteorological Agency (JP)', 0.6, 0.6],
  ['kma', 'KMA GDPS', 'Korea Meteorological Administration (KR)', -0.3, 1.1],
  ['gem', 'CMC GEM', 'Environment Canada (CA)', 1.9, 0.9],
  ['meteofrance', 'Météo-France ARPEGE', 'Météo-France (FR)', -1.2, 1.3],
];
const allModels = MODELS.map(([model, label, agency, bias, wetness]) => {
  const mh = [];
  for (let i = 0; i < 72; i++) {
    const ms = start + i * 3600e3;
    const h = new Date(ms).getUTCHours();
    const dayIdx = Math.floor((14 + i) / 24);
    const t = r1(hourlyTemp(h, dayIdx) + bias * (0.5 + i / 72) + (rand() - 0.5) * 1.2);
    const rainy = i >= 25 && i <= 34;
    mh.push({
      time: iso(ms),
      temperature: t,
      precipitationProbability: model === 'jma' ? null : rainy ? Math.min(100, Math.round(50 * wetness + rand() * 30)) : Math.round(rand() * 10),
      precipitation: rainy ? r1(rand() * 1.8 * wetness) : 0,
      condition: cond(rainy ? 61 : h >= 7 && h < 19 ? 1 : 0, h >= 7 && h < 19),
    });
  }
  const md = daily.slice(0, 7).map((d, k) => ({
    date: d.date,
    temperatureMin: r1(d.temperatureMin + bias * 0.6 + (rand() - 0.5) * (1 + k * 0.4)),
    temperatureMax: r1(d.temperatureMax + bias + (rand() - 0.5) * (1 + k * 0.5)),
    precipitationSum: d.precipitationSum ? r1(d.precipitationSum * wetness * (0.6 + rand() * 0.8)) : k > 4 && rand() > 0.7 ? 0.4 : 0,
    condition: d.pm.condition,
  }));
  return { model, label, agency, hourly: mh, daily: md };
});
function consensusOf(models) {
  return models[0].daily.map((_, k) => {
    const maxes = models.map((m) => m.daily[k].temperatureMax);
    const precs = models.map((m) => m.daily[k].precipitationSum);
    const mean = maxes.reduce((a, b) => a + b, 0) / maxes.length;
    const spread = Math.max(...maxes) - Math.min(...maxes);
    return {
      date: models[0].daily[k].date,
      temperatureMaxMean: r1(mean),
      temperatureMaxSpread: r1(spread),
      precipitationSumMean: r1(precs.reduce((a, b) => a + b, 0) / precs.length),
      agreement: spread <= 2 ? 'high' : spread <= 4 ? 'medium' : 'low',
    };
  });
}
// All seven models; the fixture client filters by `models=` like the real endpoint.
const compare = { data: { location: UB, models: allModels, consensus: consensusOf(allModels) }, meta: META };

const catalog = [...MN, ...KR, ...WORLD].map(([l]) => l);

const write = (name, obj) => writeFileSync(out + name, JSON.stringify(obj, null, name.startsWith('compare') ? 0 : 2) + '\n');
write('weather.json', weather);
write('air.json', air);
write('compare.json', compare);
write('nation-mn.json', nation('mn', 'Mongolia', MN));
write('nation-kr.json', nation('kr', 'South Korea', KR));
write('nation-world.json', nation('world', 'World', WORLD));
write('locations.json', { data: catalog, meta: META });
// Region[] (notification regions; the UI hardcodes the three /nation groups instead).
write('regions.json', {
  data: [...MN, ...KR].map(([l]) => ({
    id: `${l.countryCode.toLowerCase()}-${l.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]+/g, '-')}`,
    name: l.name,
    country: l.countryCode,
    lat: l.lat,
    lon: l.lon,
  })),
  meta: META,
});

// ---------------- predict (AI post-processing) ----------------
const predHourly = [];
for (let i = 0; i < 72; i++) {
  const ms = start + i * 3600e3;
  const h = new Date(ms).getUTCHours();
  const dayIdx = Math.floor((14 + i) / 24);
  const nwp = r1(hourlyTemp(h, dayIdx) + (rand() - 0.5) * 0.6);
  const corr = r1(nwp - 0.6 - 0.4 * Math.cos(((h - 4) / 24) * 2 * Math.PI)); // NWP runs warm at night in UB
  const spread = 0.8 + i * 0.035;
  const rainy = i >= 26 && i <= 33;
  predHourly.push({
    time: iso(ms),
    temperature: corr,
    temperatureNwp: nwp,
    temperatureP10: r1(corr - spread),
    temperatureP90: r1(corr + spread * 0.9),
    precipitationProbability: rainy ? 45 + Math.round(rand() * 30) : Math.round(rand() * 8),
    precipitation: rainy ? r1(rand() * 1.6) : 0,
  });
}
const predDaily = [0, 1, 2, 3].map((d) => {
  const ms = Date.UTC(2026, 9, 1 + d);
  const day = daily[d];
  return {
    date: isoDate(ms),
    temperatureMin: r1(day.temperatureMin - 0.9),
    temperatureMax: r1(day.temperatureMax - 0.3),
    temperatureMinP10: r1(day.temperatureMin - 2.6 - d * 0.4),
    temperatureMaxP90: r1(day.temperatureMax + 1.4 + d * 0.4),
    precipitationSum: r1(day.precipitationSum * 0.8),
    hazardProbabilities: d === 0 ? { 'strong-wind': 0.72, 'fine-dust': 0.31 } : d === 1 ? { 'strong-wind': 0.35, dry: 0.12 } : d === 3 ? { 'cold-wave': 0.28 } : {},
  };
});
write('predict.json', {
  data: {
    location: UB,
    generatedAt: '2026-10-01T06:02:00Z',
    horizonHours: 72,
    hourly: predHourly,
    daily: predDaily,
    risks: [
      { hazard: 'strong-wind', severity: 'advisory', probability: 0.72, expectedStart: '2026-10-01T15:00', rationale: '5 of 7 models gust above 10 m/s this afternoon; spread narrow.' },
      { hazard: 'fine-dust', severity: 'advisory', probability: 0.31, expectedStart: '2026-10-01T21:00', rationale: 'Evening inversion and stove smoke typically push PM2.5 into "bad".' },
      { hazard: 'cold-wave', severity: 'warning', probability: 0.28, rationale: 'Minimum near -9 °C on Oct 6 in 2 of 7 members.' },
    ],
    summary: 'Slightly cooler than raw guidance overnight; breezy this afternoon with a 72% chance of strong-wind advisory conditions. Light rain likely tomorrow afternoon.',
    model: {
      name: 'skycast-gbr-v1',
      version: '1.3.0',
      algorithm: 'gradient-boosting',
      trainedAt: '2026-09-28T00:00:00Z',
      trainingSamples: 18432,
      metrics: { temperatureMae: 1.2, temperatureMaeNwp: 1.9, precipitationBrier: 0.11 },
      features: ['NWP temperature', 'hour of day', 'recent residual', 'ensemble spread', 'elevation'],
    },
  },
  meta: { ...META, provider: 'skycast-ai' },
});
console.log('fixtures written to', out);
