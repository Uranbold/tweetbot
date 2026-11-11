import type { AirGrade, AlertSeverity, AlertType, NotificationPreferences } from '../types.js';

export type Locale = NotificationPreferences['locale'];

const HAZARD: Record<Locale, Record<AlertType, string>> = {
  en: {
    'heat-wave': 'Heat wave', 'cold-wave': 'Cold wave', 'heavy-rain': 'Heavy rain', 'heavy-snow': 'Heavy snow',
    'strong-wind': 'Strong wind', dry: 'Dry weather', 'fine-dust': 'Fine dust', typhoon: 'Typhoon',
  },
  ko: {
    'heat-wave': '폭염', 'cold-wave': '한파', 'heavy-rain': '호우', 'heavy-snow': '대설',
    'strong-wind': '강풍', dry: '건조', 'fine-dust': '미세먼지', typhoon: '태풍',
  },
  mn: {
    'heat-wave': 'Халуун', 'cold-wave': 'Хүйтний давалгаа', 'heavy-rain': 'Аадар бороо', 'heavy-snow': 'Их цас',
    'strong-wind': 'Хүчтэй салхи', dry: 'Хуурайшилт', 'fine-dust': 'Тоос, агаарын бохирдол', typhoon: 'Хар салхи',
  },
};

const SEVERITY: Record<Locale, Record<AlertSeverity, string>> = {
  en: { advisory: 'advisory', warning: 'warning' },
  ko: { advisory: '주의보', warning: '경보' },
  mn: { advisory: 'анхааруулга', warning: 'сэрэмжлүүлэг' },
};

const GRADE: Record<Locale, Record<AirGrade, string>> = {
  en: { good: 'Good', moderate: 'Moderate', bad: 'Bad', 'very-bad': 'Very bad' },
  ko: { good: '좋음', moderate: '보통', bad: '나쁨', 'very-bad': '매우나쁨' },
  mn: { good: 'Сайн', moderate: 'Дунд', bad: 'Муу', 'very-bad': 'Маш муу' },
};

export function alertTitle(locale: Locale, type: AlertType, severity: AlertSeverity): string {
  const h = HAZARD[locale][type];
  const s = SEVERITY[locale][severity];
  if (locale === 'ko') return `${h}${s}`;
  if (locale === 'mn') return `${h}: ${s}`;
  return `${h} ${s}`;
}

export function aiRiskTitle(locale: Locale, type: AlertType, probability: number): string {
  const h = HAZARD[locale][type];
  const p = Math.round(probability * 100);
  if (locale === 'ko') return `${h} 가능성 ${p}%`;
  if (locale === 'mn') return `${h} болзошгүй (${p}%)`;
  return `${h} likely (${p}%)`;
}

export function airTitle(locale: Locale, grade: AirGrade): string {
  const g = GRADE[locale][grade];
  if (locale === 'ko') return `대기질 ${g}`;
  if (locale === 'mn') return `Агаарын чанар: ${g}`;
  return `Air quality: ${g}`;
}

export function airBody(locale: Locale, region: string, pm10: number, pm25: number): string {
  const v = `PM10 ${Math.round(pm10)} · PM2.5 ${Math.round(pm25)} µg/m³`;
  if (locale === 'ko') return `${region} ${v}. 장시간 실외활동을 자제하세요.`;
  if (locale === 'mn') return `${region}: ${v}. Гадаа удаан байхаас зайлсхийнэ үү.`;
  return `${region}: ${v}. Limit prolonged outdoor activity.`;
}

export function briefingTitle(locale: Locale, region: string): string {
  if (locale === 'ko') return `오늘의 날씨 · ${region}`;
  if (locale === 'mn') return `Өнөөдрийн цаг агаар · ${region}`;
  return `Today in ${region}`;
}

export function briefingBody(locale: Locale, headline: string, max: number, min: number): string {
  const hi = Math.round(max);
  const lo = Math.round(min);
  if (locale === 'ko') return `최고 ${hi}° / 최저 ${lo}° · ${headline}`;
  if (locale === 'mn') return `Дээд ${hi}° / доод ${lo}° · ${headline}`;
  return `${headline}. High ${hi}°, low ${lo}°.`;
}

export function testTitle(locale: Locale): string {
  return locale === 'ko' ? 'Skycast 테스트 알림' : locale === 'mn' ? 'Skycast туршилтын мэдэгдэл' : 'Skycast test notification';
}

export function testBody(locale: Locale, region: string): string {
  if (locale === 'ko') return `${region} 알림이 정상적으로 설정되었습니다.`;
  if (locale === 'mn') return `${region} бүсийн мэдэгдэл амжилттай тохируулагдлаа.`;
  return `Notifications for ${region} are working.`;
}
