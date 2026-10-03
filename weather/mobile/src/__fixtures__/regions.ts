import type {
  AirQualitySnapshot,
  Device,
  HazardRisk,
  NotificationHistoryEntry,
  NotificationMessage,
  Region,
  WeatherAlert,
} from '@contract';
import { predictFixture } from './predict';
import { weatherFixture } from './weather';

export const regionsFixture: Region[] = [
  {
    id: 'mn-ulaanbaatar',
    name: 'Ulaanbaatar',
    country: 'MN',
    lat: 47.92,
    lon: 106.92,
    bbox: { minLat: 47.7, minLon: 106.6, maxLat: 48.1, maxLon: 107.3 },
  },
  { id: 'mn-darkhan', name: 'Darkhan-Uul', country: 'MN', lat: 49.49, lon: 105.92 },
  { id: 'mn-erdenet', name: 'Orkhon (Erdenet)', country: 'MN', lat: 49.03, lon: 104.08 },
  { id: 'mn-khovd', name: 'Khovd', country: 'MN', lat: 48.0, lon: 91.64 },
  { id: 'mn-dornod', name: 'Dornod', country: 'MN', lat: 48.07, lon: 114.5 },
  { id: 'mn-umnugovi', name: 'Umnugovi', country: 'MN', lat: 43.57, lon: 104.42 },
  { id: 'mn-uvs', name: 'Uvs', country: 'MN', lat: 49.98, lon: 92.07 },
  { id: 'mn-bayan-ulgii', name: 'Bayan-Ulgii', country: 'MN', lat: 48.97, lon: 89.96 },
  {
    id: 'kr-seoul',
    name: 'Seoul',
    country: 'KR',
    lat: 37.57,
    lon: 126.98,
    bbox: { minLat: 37.42, minLon: 126.76, maxLat: 37.7, maxLon: 127.18 },
  },
  { id: 'kr-busan', name: 'Busan', country: 'KR', lat: 35.18, lon: 129.08 },
  { id: 'kr-incheon', name: 'Incheon', country: 'KR', lat: 37.46, lon: 126.71 },
  { id: 'kr-daegu', name: 'Daegu', country: 'KR', lat: 35.87, lon: 128.6 },
  { id: 'kr-gangwon', name: 'Gangwon', country: 'KR', lat: 37.88, lon: 127.73 },
  { id: 'kr-jeju', name: 'Jeju', country: 'KR', lat: 33.5, lon: 126.53 },
];

export const regionAlertsFixture: Record<
  string,
  { alerts: WeatherAlert[]; risks: HazardRisk[]; air: AirQualitySnapshot | null }
> = {
  'mn-ulaanbaatar': {
    alerts: weatherFixture.alerts,
    risks: predictFixture.risks,
    air: weatherFixture.air,
  },
  'kr-seoul': {
    alerts: [
      {
        type: 'heavy-rain',
        severity: 'advisory',
        title: 'Heavy rain advisory',
        description: '60 mm in 3 h expected tonight',
        start: '2026-10-01T20:00',
        end: '2026-10-02T06:00',
        source: 'derived',
      },
    ],
    risks: [
      {
        hazard: 'heavy-rain',
        severity: 'advisory',
        probability: 0.57,
        expectedStart: '2026-10-01T21:00',
        rationale: 'Front stalls over the capital region; 5/7 models above 50 mm',
      },
    ],
    air: {
      time: '2026-10-01T14:00',
      pm10: 32,
      pm25: 18,
      o3: 40,
      no2: 30,
      so2: 4,
      co: 380,
      pm10Grade: 'good',
      pm25Grade: 'moderate',
      overallGrade: 'moderate',
      usAqi: 64,
    },
  },
};

export const emptyRegionAlerts = { alerts: [], risks: [], air: null };

export const deviceFixture: Device = {
  id: 'dev_fixture_0001',
  pushToken: 'ExponentPushToken[fixture]',
  platform: 'android',
  regionIds: ['mn-ulaanbaatar', 'kr-seoul'],
  followLocation: false,
  preferences: {
    alertTypes: ['heat-wave', 'cold-wave', 'heavy-rain', 'heavy-snow', 'strong-wind', 'dry', 'fine-dust', 'typhoon'],
    minSeverity: 'advisory',
    aiRiskThreshold: 0.6,
    dailyBriefingHour: 7,
    airGradeThreshold: 'bad',
    quietHours: { start: 22, end: 7 },
    locale: 'en',
  },
  appVersion: '0.1.0',
  createdAt: '2026-09-30T10:00:00Z',
  updatedAt: '2026-10-01T05:00:00Z',
};

export const testNotificationFixture: NotificationMessage = {
  id: 'ntf_test_0001',
  kind: 'test',
  regionId: 'mn-ulaanbaatar',
  title: 'Skycast test',
  body: 'Push notifications are working.',
  deepLink: 'skycast://region/mn-ulaanbaatar',
  dedupKey: 'test:mn-ulaanbaatar:2026-10-01',
  sentAt: '2026-10-01T06:01:00Z',
  data: { regionId: 'mn-ulaanbaatar' },
};

export const notificationHistoryFixture: NotificationHistoryEntry[] = [
  {
    id: 'ntf_0003',
    kind: 'alert',
    regionId: 'mn-ulaanbaatar',
    title: 'Fine dust warning — Ulaanbaatar',
    body: 'PM10 above 150 µg/m³ for 2 h. Limit outdoor activity.',
    deepLink: 'skycast://region/mn-ulaanbaatar/alerts',
    severity: 'warning',
    dedupKey: 'alert:mn-ulaanbaatar:fine-dust:2026-10-01',
    sentAt: '2026-10-01T04:10:00Z',
    data: { regionId: 'mn-ulaanbaatar', type: 'fine-dust' },
    deliveredTo: 1,
  },
  {
    id: 'ntf_0002',
    kind: 'ai-risk',
    regionId: 'mn-ulaanbaatar',
    title: 'AI: cold wave likely Saturday (81%)',
    body: '6/7 models below -10 °C Saturday morning.',
    deepLink: 'skycast://region/mn-ulaanbaatar/alerts',
    severity: 'warning',
    dedupKey: 'ai-risk:mn-ulaanbaatar:cold-wave:2026-10-03',
    sentAt: '2026-09-30T22:00:00Z',
    data: { regionId: 'mn-ulaanbaatar', hazard: 'cold-wave', probability: '0.81' },
    deliveredTo: 1,
  },
  {
    id: 'ntf_0001',
    kind: 'daily-briefing',
    regionId: 'kr-seoul',
    title: 'Seoul today: 21° / 14°, rain tonight',
    body: 'Heavy rain advisory from 20:00. Air quality moderate.',
    deepLink: 'skycast://region/kr-seoul',
    dedupKey: 'daily-briefing:kr-seoul:2026-10-01',
    sentAt: '2026-09-30T22:00:00Z',
    data: { regionId: 'kr-seoul' },
    deliveredTo: 1,
  },
];
