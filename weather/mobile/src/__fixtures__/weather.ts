import type { ApiMeta, Condition, ConditionKey, DailyPoint, HourlyPoint, Location, TodayWeather } from '@contract';

export const fixtureMeta: ApiMeta = {
  provider: 'fixture',
  fetchedAt: '2026-10-01T06:00:00Z',
  stale: false,
  mock: true,
};

export const ulaanbaatar: Location = {
  id: '2028462',
  name: 'Ulaanbaatar',
  admin1: 'Ulaanbaatar',
  country: 'Mongolia',
  countryCode: 'MN',
  lat: 47.92,
  lon: 106.92,
  timezone: 'Asia/Ulaanbaatar',
  utcOffsetSeconds: 28800,
  elevation: 1350,
};

const LABELS: Record<ConditionKey, string> = {
  clear: 'Clear',
  'mostly-clear': 'Mostly clear',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  'heavy-rain': 'Heavy rain',
  'freezing-rain': 'Freezing rain',
  snow: 'Snow',
  'heavy-snow': 'Heavy snow',
  sleet: 'Sleet',
  thunderstorm: 'Thunderstorm',
};

const CODES: Record<ConditionKey, number> = {
  clear: 0,
  'mostly-clear': 1,
  'partly-cloudy': 2,
  cloudy: 3,
  fog: 45,
  drizzle: 51,
  rain: 61,
  'heavy-rain': 65,
  'freezing-rain': 66,
  snow: 71,
  'heavy-snow': 75,
  sleet: 77,
  thunderstorm: 95,
};

export function cond(key: ConditionKey, isDay = true): Condition {
  return { code: CODES[key], key, label: LABELS[key], isDay };
}

const pad = (n: number) => String(n).padStart(2, '0');

function hourlySeries(): HourlyPoint[] {
  const out: HourlyPoint[] = [];
  const keys: ConditionKey[] = ['partly-cloudy', 'cloudy', 'rain', 'clear', 'mostly-clear'];
  for (let i = 0; i < 48; i++) {
    const h = (14 + i) % 24;
    const dayOffset = Math.floor((14 + i) / 24);
    const date = dayOffset === 0 ? '2026-10-01' : dayOffset === 1 ? '2026-10-02' : '2026-10-03';
    const isDay = h >= 7 && h < 19;
    const temp = 6 + 8 * Math.sin(((h - 5) / 24) * Math.PI * 2) - dayOffset * 1.5;
    const key = keys[Math.floor(i / 10) % keys.length] ?? 'clear';
    out.push({
      time: `${date}T${pad(h)}:00`,
      temperature: Math.round(temp * 10) / 10,
      feelsLike: Math.round((temp - 2.5) * 10) / 10,
      condition: cond(key, isDay),
      precipitationProbability: key === 'rain' ? 70 : key === 'cloudy' ? 30 : 5,
      precipitation: key === 'rain' ? 1.2 : 0,
      snowfall: 0,
      humidity: 50 + (i % 20),
      windSpeed: 3 + (i % 5),
      windDirection: (300 + i * 7) % 360,
      uvIndex: isDay ? 3 : 0,
    });
  }
  return out;
}

function dailySeries(): DailyPoint[] {
  const days: { date: string; min: number; max: number; am: ConditionKey; pm: ConditionKey; pp: number }[] = [
    { date: '2026-10-01', min: -1, max: 14, am: 'partly-cloudy', pm: 'rain', pp: 60 },
    { date: '2026-10-02', min: -3, max: 11, am: 'cloudy', pm: 'cloudy', pp: 30 },
    { date: '2026-10-03', min: -6, max: 7, am: 'snow', pm: 'heavy-snow', pp: 80 },
    { date: '2026-10-04', min: -9, max: 3, am: 'clear', pm: 'mostly-clear', pp: 0 },
    { date: '2026-10-05', min: -11, max: 2, am: 'clear', pm: 'clear', pp: 0 },
    { date: '2026-10-06', min: -7, max: 6, am: 'mostly-clear', pm: 'partly-cloudy', pp: 10 },
    { date: '2026-10-07', min: -4, max: 9, am: 'partly-cloudy', pm: 'cloudy', pp: 20 },
    { date: '2026-10-08', min: -2, max: 12, am: 'fog', pm: 'clear', pp: 5 },
    { date: '2026-10-09', min: 0, max: 13, am: 'clear', pm: 'clear', pp: 0 },
    { date: '2026-10-10', min: 1, max: 15, am: 'clear', pm: 'partly-cloudy', pp: 10 },
  ];
  return days.map((d) => ({
    date: d.date,
    temperatureMin: d.min,
    temperatureMax: d.max,
    am: { condition: cond(d.am, true), precipitationProbability: Math.max(0, d.pp - 20) },
    pm: { condition: cond(d.pm, true), precipitationProbability: d.pp },
    precipitationSum: d.pp >= 60 ? 4.2 : 0,
    snowfallSum: d.am === 'snow' || d.pm === 'heavy-snow' ? 6 : 0,
    sunrise: `${d.date}T06:48`,
    sunset: `${d.date}T18:22`,
    uvIndexMax: 4,
    windSpeedMax: 9,
  }));
}

export const weatherFixture: TodayWeather = {
  location: ulaanbaatar,
  current: {
    time: '2026-10-01T14:00',
    temperature: 12.4,
    feelsLike: 9.8,
    condition: cond('partly-cloudy', true),
    humidity: 38,
    windSpeed: 5.2,
    windGust: 11.1,
    windDirection: 315,
    windDirectionLabel: 'NW',
    precipitation: 0,
    pressure: 1018,
    cloudCover: 45,
    visibility: 24,
    uvIndex: 3,
  },
  comparison: { temperatureDiff: 2.3, message: '2.3° warmer than yesterday' },
  today: {
    temperatureMin: -1,
    temperatureMax: 14,
    sunrise: '2026-10-01T06:48',
    sunset: '2026-10-01T18:22',
    headline: 'Partly cloudy, rain likely after 6 PM',
  },
  hourly: hourlySeries(),
  daily: dailySeries(),
  air: {
    time: '2026-10-01T14:00',
    pm10: 86,
    pm25: 41,
    o3: 60,
    no2: 22,
    so2: 6,
    co: 410,
    pm10Grade: 'bad',
    pm25Grade: 'moderate',
    overallGrade: 'bad',
    usAqi: 112,
  },
  lifeIndices: [
    { key: 'uv', label: 'UV index', level: 'moderate', value: 3, advice: 'Sunscreen if outside long' },
    { key: 'laundry', label: 'Laundry', level: 'low', advice: 'Rain later — dry indoors' },
    { key: 'car-wash', label: 'Car wash', level: 'very-low', advice: 'Rain expected, wait' },
    { key: 'outdoor-activity', label: 'Outdoor activity', level: 'moderate', advice: 'Fine until evening' },
    { key: 'wind-chill', label: 'Wind chill', level: 'low', advice: 'Light breeze' },
  ],
  alerts: [
    {
      type: 'cold-wave',
      severity: 'advisory',
      title: 'Cold wave advisory',
      description: 'Morning low below -10 °C expected Sunday',
      start: '2026-10-04T00:00',
      end: '2026-10-05T12:00',
      source: 'derived',
    },
    {
      type: 'fine-dust',
      severity: 'warning',
      title: 'Fine dust warning',
      description: 'PM10 above 150 µg/m³ for 2 h',
      start: '2026-10-01T12:00',
      source: 'derived',
    },
  ],
  clothing: {
    summary: 'Light jacket, long sleeves',
    items: ['Light jacket', 'Long sleeves', 'Umbrella for the evening'],
  },
};
