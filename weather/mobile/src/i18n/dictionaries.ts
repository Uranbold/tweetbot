import type { AirGrade, AlertSeverity, AlertType, NotificationKind } from '@contract';
import type { Locale } from './types';

export interface Dictionary {
  tabs: { today: string; ai: string; alerts: string; settings: string };
  weather: string;
  alerts: string;
  airQuality: string;
  settings: string;
  feelsLike: string;
  humidity: string;
  wind: string;
  gust: string;
  uv: string;
  pm10: string;
  pm25: string;
  hourly: string;
  daily: string;
  today: string;
  tomorrow: string;
  am: string;
  pm: string;
  clothing: string;
  lifeIndices: string;
  sunrise: string;
  sunset: string;
  loading: string;
  retry: string;
  errorGeneric: string;
  offline: string;
  demoData: string;
  stale: string;
  noAlerts: string;
  noRegions: string;
  noRegionsHint: string;
  aiSummary: string;
  aiRisks: string;
  aiChart: string;
  aiModel: string;
  aiTemp: string;
  nwpTemp: string;
  band: string;
  expectedStart: string;
  mae: string;
  raw: string;
  trainedOn: string;
  samples: string;
  features: string;
  climatologyFallback: string;
  activeAlerts: string;
  aiRiskShort: string;
  history: string;
  noHistory: string;
  sendTest: string;
  sending: string;
  testSent: string;
  scheduleLocal: string;
  localScheduled: string;
  regions: string;
  searchRegions: string;
  followLocation: string;
  followLocationHint: string;
  locationDenied: string;
  notifications: string;
  notifEnabled: string;
  notifDenied: string;
  notifUndetermined: string;
  notifUnsupported: string;
  openSettings: string;
  requestPermission: string;
  prefAlertTypes: string;
  prefMinSeverity: string;
  prefAiThreshold: string;
  prefAiThresholdOff: string;
  prefBriefing: string;
  prefBriefingOff: string;
  prefAirThreshold: string;
  prefAirOff: string;
  prefQuietHours: string;
  prefQuietOff: string;
  prefQuietFrom: string;
  prefQuietTo: string;
  prefLocale: string;
  deviceId: string;
  notRegistered: string;
  synced: string;
  syncing: string;
  syncError: string;
  devTools: string;
  regionNotFound: string;
  viewAlerts: string;
  viewWeather: string;
  subscribed: string;
  subscribe: string;
  unsubscribe: string;
  warmerThanYesterday: (diff: number) => string;
  showMore: (total: number) => string;
  showLess: string;
  aiEstimate: string;
  aiUnavailable: string;
  saved: string;
  sectionWhat: string;
  sectionWhen: string;
  sectionLanguage: string;
  setupTitle: string;
  setupProgress: (done: number, total: number) => string;
  setupPermission: string;
  setupRegion: string;
  setupTest: string;
  notifOn: string;
  notifOff: string;
  nearestRegion: string;
  selectedCount: (n: number) => string;
  aiRiskAlerts: string;
  loadedWeather: (place: string) => string;
  now: string;
  updatedAt: (time: string) => string;
  alertType: Record<AlertType, string>;
  severity: Record<AlertSeverity, string>;
  grade: Record<AirGrade, string>;
  kind: Record<NotificationKind, string>;
  gpsLabel: string;
}

const alertTypeEn: Record<AlertType, string> = {
  'heat-wave': 'Heat wave',
  'cold-wave': 'Cold wave',
  'heavy-rain': 'Heavy rain',
  'heavy-snow': 'Heavy snow',
  'strong-wind': 'Strong wind',
  dry: 'Dry',
  'fine-dust': 'Fine dust',
  typhoon: 'Typhoon',
};

export const en: Dictionary = {
  tabs: { today: 'Today', ai: 'AI Forecast', alerts: 'Alerts', settings: 'Settings' },
  weather: 'Weather',
  alerts: 'Alerts',
  airQuality: 'Air quality',
  settings: 'Regions & Notifications',
  feelsLike: 'Feels like',
  humidity: 'Humidity',
  wind: 'Wind',
  gust: 'Gust',
  uv: 'UV',
  pm10: 'PM10',
  pm25: 'PM2.5',
  hourly: 'Hourly',
  daily: '10-day forecast',
  today: 'Today',
  tomorrow: 'Tomorrow',
  am: 'AM',
  pm: 'PM',
  clothing: 'What to wear',
  lifeIndices: 'Life indices',
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  loading: 'Loading…',
  retry: 'Retry',
  errorGeneric: 'Could not load data.',
  offline: 'You seem to be offline.',
  demoData: 'Demo data',
  stale: 'Stale',
  noAlerts: 'No active alerts',
  noRegions: 'No regions yet',
  noRegionsHint: 'Pick regions in Settings to receive alerts.',
  aiSummary: 'AI summary',
  aiRisks: 'Hazard risks (72 h)',
  aiChart: 'AI temperature vs. raw model',
  aiModel: 'Model',
  aiTemp: 'AI',
  nwpTemp: 'Raw NWP',
  band: 'P10–P90',
  expectedStart: 'Expected from',
  mae: 'MAE',
  raw: 'raw',
  trainedOn: 'trained on',
  samples: 'samples',
  features: 'Features',
  climatologyFallback: 'Climatology fallback (no training data for this location)',
  activeAlerts: 'Active alerts',
  aiRiskShort: 'AI risk',
  history: 'Notification history',
  noHistory: 'No notifications sent yet.',
  sendTest: 'Send test notification',
  sending: 'Sending…',
  testSent: 'Test notification sent',
  scheduleLocal: 'Schedule local test alert in 5 s',
  localScheduled: 'Local alert scheduled',
  regions: 'Regions',
  searchRegions: 'Search regions…',
  followLocation: 'Follow my location',
  followLocationHint: 'Uses your GPS position to pick the nearest region (foreground only).',
  locationDenied: 'Location permission denied.',
  notifications: 'Notifications',
  notifEnabled: 'Notifications: enabled',
  notifDenied: 'Notifications: denied',
  notifUndetermined: 'Notifications: not requested',
  notifUnsupported: 'Push notifications are not available on web.',
  openSettings: 'Open OS settings',
  requestPermission: 'Enable notifications',
  prefAlertTypes: 'Alert types',
  prefMinSeverity: 'Minimum severity',
  prefAiThreshold: 'AI risk threshold',
  prefAiThresholdOff: 'AI risk alerts off',
  prefBriefing: 'Daily briefing',
  prefBriefingOff: 'Off',
  prefAirThreshold: 'Air quality threshold',
  prefAirOff: 'Off',
  prefQuietHours: 'Quiet hours',
  prefQuietOff: 'Off',
  prefQuietFrom: 'From',
  prefQuietTo: 'To',
  prefLocale: 'Language',
  deviceId: 'Device',
  notRegistered: 'Not registered yet',
  synced: 'Synced',
  syncing: 'Syncing…',
  syncError: 'Sync failed — will retry',
  devTools: 'Developer',
  regionNotFound: 'Region not found',
  viewAlerts: 'Alerts',
  viewWeather: 'Weather',
  subscribed: 'Subscribed',
  subscribe: 'Subscribe',
  unsubscribe: 'Unsubscribe',
  warmerThanYesterday: (diff) =>
    diff === 0
      ? 'Same as yesterday'
      : `${Math.abs(diff).toFixed(1)}° ${diff > 0 ? 'warmer' : 'colder'} than yesterday`,
  showMore: (total) => `Show ${total} days`,
  showLess: 'Show less',
  aiEstimate: 'AI estimate',
  aiUnavailable: 'AI forecast unavailable.',
  saved: 'Saved',
  sectionWhat: 'What',
  sectionWhen: 'When',
  sectionLanguage: 'Language',
  setupTitle: 'Set up alerts',
  setupProgress: (done, total) => `${done} of ${total} set up`,
  setupPermission: 'Allow notifications',
  setupRegion: 'Pick a region',
  setupTest: 'Send a test',
  notifOn: 'Notifications: On',
  notifOff: 'Notifications: Off — enable in Settings',
  nearestRegion: 'Nearest region',
  selectedCount: (n) => `${n} selected`,
  aiRiskAlerts: 'AI risk alerts',
  loadedWeather: (place) => `Loaded weather for ${place}`,
  now: 'Now',
  updatedAt: (time) => `Updated ${time}`,
  alertType: alertTypeEn,
  severity: { advisory: 'Advisory', warning: 'Warning' },
  grade: { good: 'Good', moderate: 'Moderate', bad: 'Bad', 'very-bad': 'Very bad' },
  kind: {
    alert: 'Alert',
    'ai-risk': 'AI risk',
    'air-quality': 'Air quality',
    'daily-briefing': 'Daily briefing',
    test: 'Test',
  },
  gpsLabel: 'Current location',
};

export const mn: Dictionary = {
  ...en,
  tabs: { today: 'Өнөөдөр', ai: 'AI таамаг', alerts: 'Сэрэмжлүүлэг', settings: 'Тохиргоо' },
  weather: 'Цаг агаар',
  alerts: 'Сэрэмжлүүлэг',
  airQuality: 'Агаарын чанар',
  settings: 'Бүс нутаг ба мэдэгдэл',
  feelsLike: 'Мэдрэгдэх',
  humidity: 'Чийгшил',
  wind: 'Салхи',
  hourly: 'Цагаар',
  daily: '10 хоногийн таамаг',
  today: 'Өнөөдөр',
  tomorrow: 'Маргааш',
  am: 'Өглөө',
  pm: 'Өдөр',
  clothing: 'Хувцаслалт',
  lifeIndices: 'Амьдралын индекс',
  loading: 'Ачаалж байна…',
  retry: 'Дахин оролдох',
  errorGeneric: 'Өгөгдөл ачаалж чадсангүй.',
  demoData: 'Жишээ өгөгдөл',
  noAlerts: 'Идэвхтэй сэрэмжлүүлэг алга',
  noRegions: 'Бүс нутаг сонгоогүй байна',
  noRegionsHint: 'Тохиргооноос бүс нутаг сонгож сэрэмжлүүлэг аваарай.',
  aiSummary: 'AI дүгнэлт',
  aiRisks: 'Аюулын эрсдэл (72 ц)',
  aiChart: 'AI температур ба түүхий загвар',
  aiModel: 'Загвар',
  activeAlerts: 'Идэвхтэй сэрэмжлүүлэг',
  aiRiskShort: 'AI эрсдэл',
  history: 'Мэдэгдлийн түүх',
  noHistory: 'Мэдэгдэл илгээгдээгүй байна.',
  sendTest: 'Туршилтын мэдэгдэл илгээх',
  regions: 'Бүс нутаг',
  searchRegions: 'Бүс нутаг хайх…',
  followLocation: 'Миний байршлыг дагах',
  notifications: 'Мэдэгдэл',
  notifEnabled: 'Мэдэгдэл: идэвхтэй',
  notifDenied: 'Мэдэгдэл: татгалзсан',
  notifUndetermined: 'Мэдэгдэл: хүсэлт илгээгээгүй',
  openSettings: 'Тохиргоо нээх',
  requestPermission: 'Мэдэгдэл идэвхжүүлэх',
  prefAlertTypes: 'Сэрэмжлүүлгийн төрөл',
  prefMinSeverity: 'Доод түвшин',
  prefAiThreshold: 'AI эрсдэлийн босго',
  prefBriefing: 'Өдөр тутмын тойм',
  prefAirThreshold: 'Агаарын чанарын босго',
  prefQuietHours: 'Чимээгүй цаг',
  prefLocale: 'Хэл',
  warmerThanYesterday: (diff) =>
    diff === 0
      ? 'Өчигдөртэй адил'
      : `Өчигдрөөс ${Math.abs(diff).toFixed(1)}° ${diff > 0 ? 'дулаан' : 'хүйтэн'}`,
  showMore: (total) => `${total} хоног харах`,
  showLess: 'Хураах',
  aiEstimate: 'AI тооцоо',
  saved: 'Хадгалагдсан',
  sectionWhat: 'Юу',
  sectionWhen: 'Хэзээ',
  sectionLanguage: 'Хэл',
  setupTitle: 'Сэрэмжлүүлэг тохируулах',
  setupProgress: (done, total) => `${total}-с ${done} бэлэн`,
  setupPermission: 'Мэдэгдэл зөвшөөрөх',
  setupRegion: 'Бүс нутаг сонгох',
  setupTest: 'Туршилт илгээх',
  notifOn: 'Мэдэгдэл: Идэвхтэй',
  notifOff: 'Мэдэгдэл: Унтраалттай — Тохиргоонд идэвхжүүл',
  nearestRegion: 'Хамгийн ойр бүс',
  selectedCount: (n) => `${n} сонгосон`,
  aiRiskAlerts: 'AI эрсдэлийн мэдэгдэл',
  loadedWeather: (place) => `${place}-н цаг агаар ачаалагдлаа`,
  now: 'Одоо',
  alertType: {
    'heat-wave': 'Халуун',
    'cold-wave': 'Хүйтэн',
    'heavy-rain': 'Аадар бороо',
    'heavy-snow': 'Их цас',
    'strong-wind': 'Хүчтэй салхи',
    dry: 'Хуурайшилт',
    'fine-dust': 'Нарийн тоос',
    typhoon: 'Хар салхи',
  },
  severity: { advisory: 'Анхааруулга', warning: 'Сэрэмжлүүлэг' },
  grade: { good: 'Сайн', moderate: 'Дунд', bad: 'Муу', 'very-bad': 'Маш муу' },
  gpsLabel: 'Одоогийн байршил',
};

export const ko: Dictionary = {
  ...en,
  tabs: { today: '오늘', ai: 'AI 예보', alerts: '특보', settings: '설정' },
  weather: '날씨',
  alerts: '특보',
  airQuality: '미세먼지',
  settings: '지역 및 알림',
  feelsLike: '체감',
  humidity: '습도',
  wind: '바람',
  hourly: '시간별',
  daily: '10일 예보',
  today: '오늘',
  tomorrow: '내일',
  am: '오전',
  pm: '오후',
  clothing: '옷차림',
  lifeIndices: '생활지수',
  loading: '불러오는 중…',
  retry: '다시 시도',
  errorGeneric: '데이터를 불러오지 못했습니다.',
  demoData: '데모 데이터',
  noAlerts: '발효 중인 특보 없음',
  noRegions: '지역이 없습니다',
  noRegionsHint: '설정에서 지역을 선택하면 특보를 받을 수 있습니다.',
  aiSummary: 'AI 요약',
  aiRisks: '위험 확률 (72시간)',
  aiChart: 'AI 기온 vs 원시 모델',
  aiModel: '모델',
  activeAlerts: '발효 중인 특보',
  aiRiskShort: 'AI 위험',
  history: '알림 기록',
  noHistory: '아직 보낸 알림이 없습니다.',
  sendTest: '테스트 알림 보내기',
  regions: '지역',
  searchRegions: '지역 검색…',
  followLocation: '내 위치 따라가기',
  notifications: '알림',
  notifEnabled: '알림: 허용됨',
  notifDenied: '알림: 거부됨',
  notifUndetermined: '알림: 미요청',
  openSettings: 'OS 설정 열기',
  requestPermission: '알림 허용',
  prefAlertTypes: '특보 종류',
  prefMinSeverity: '최소 등급',
  prefAiThreshold: 'AI 위험 임계값',
  prefBriefing: '일일 브리핑',
  prefAirThreshold: '미세먼지 임계값',
  prefQuietHours: '방해 금지 시간',
  prefLocale: '언어',
  warmerThanYesterday: (diff) =>
    diff === 0 ? '어제와 같음' : `어제보다 ${Math.abs(diff).toFixed(1)}° ${diff > 0 ? '높아요' : '낮아요'}`,
  showMore: (total) => `${total}일 보기`,
  showLess: '접기',
  aiEstimate: 'AI 추정',
  saved: '저장됨',
  sectionWhat: '무엇을',
  sectionWhen: '언제',
  sectionLanguage: '언어',
  setupTitle: '알림 설정',
  setupProgress: (done, total) => `${total}개 중 ${done}개 완료`,
  setupPermission: '알림 허용',
  setupRegion: '지역 선택',
  setupTest: '테스트 보내기',
  notifOn: '알림: 켜짐',
  notifOff: '알림: 꺼짐 — 설정에서 허용',
  nearestRegion: '가장 가까운 지역',
  selectedCount: (n) => `${n}개 선택`,
  aiRiskAlerts: 'AI 위험 알림',
  loadedWeather: (place) => `${place} 날씨를 불러왔습니다`,
  now: '지금',
  alertType: {
    'heat-wave': '폭염',
    'cold-wave': '한파',
    'heavy-rain': '호우',
    'heavy-snow': '대설',
    'strong-wind': '강풍',
    dry: '건조',
    'fine-dust': '미세먼지',
    typhoon: '태풍',
  },
  severity: { advisory: '주의보', warning: '경보' },
  grade: { good: '좋음', moderate: '보통', bad: '나쁨', 'very-bad': '매우나쁨' },
  gpsLabel: '현재 위치',
};

export const DICTIONARIES: Record<Locale, Dictionary> = { en, mn, ko };
