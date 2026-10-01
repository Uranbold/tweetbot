/**
 * Built-in city catalogue (GeoNames ids, recorded from the Open-Meteo geocoding API).
 * Used for: reverse geocoding (nearest match), mock geocoding search, the /nation
 * snapshots (groups mn / kr / world) and the notification Region list.
 */

export type CityGroup = 'mn' | 'kr' | 'world';

export interface City {
  id: string;
  name: string;
  admin1?: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  timezone: string;
  elevation?: number;
  population?: number;
  aliases?: string[];
}

export const CITIES: readonly City[] = [
  { id: '2028462', name: "Ulaanbaatar", admin1: "Ulaanbaatar", country: "Mongolia", countryCode: 'MN', lat: 47.90771, lon: 106.88324, timezone: 'Asia/Ulaanbaatar', elevation: 1284, population: 844818, aliases: ["Ulan Bator", "Ulaanbaatar City", "UB", "Улаанбаатар"] },
  { id: '2031405', name: "Erdenet", admin1: "Orkhon Province", country: "Mongolia", countryCode: 'MN', lat: 49.03333, lon: 104.08333, timezone: 'Asia/Ulaanbaatar', elevation: 1307, population: 97814 },
  { id: '2031964', name: "Darkhan", admin1: "Darkhan-Uul Province", country: "Mongolia", countryCode: 'MN', lat: 49.48667, lon: 105.92278, timezone: 'Asia/Ulaanbaatar', elevation: 683, population: 83883, aliases: ["Darhan"] },
  { id: '2032054', name: "Choibalsan", admin1: "Dornod Province", country: "Mongolia", countryCode: 'MN', lat: 48.07257, lon: 114.53264, timezone: 'Asia/Ulaanbaatar', elevation: 741, population: 44835 },
  { id: '1515436', name: "Ölgii", admin1: "Bayan-Ölgii Province", country: "Mongolia", countryCode: 'MN', lat: 48.96833, lon: 89.9625, timezone: 'Asia/Hovd', elevation: 1715, population: 28400, aliases: ["Olgii", "Ulgii"] },
  { id: '1516048', name: "Khovd", admin1: "Khovd Province", country: "Mongolia", countryCode: 'MN', lat: 48.00556, lon: 91.64194, timezone: 'Asia/Hovd', elevation: 1395, population: 29800, aliases: ["Hovd"] },
  { id: '2029945', name: "Mörön", admin1: "Khövsgöl Province", country: "Mongolia", countryCode: 'MN', lat: 49.63417, lon: 100.1625, timezone: 'Asia/Ulaanbaatar', elevation: 1280, population: 39404, aliases: ["Moron", "Murun"] },
  { id: '1515007', name: "Uliastai", admin1: "Zavkhan Province", country: "Mongolia", countryCode: 'MN', lat: 47.74167, lon: 96.84444, timezone: 'Asia/Hovd', elevation: 1755, population: 16265 },
  { id: '1516393', name: "Altai", admin1: "Govi-Altai Province", country: "Mongolia", countryCode: 'MN', lat: 46.37222, lon: 96.25833, timezone: 'Asia/Hovd', elevation: 2156, population: 17617 },
  { id: '2028606', name: "Tsetserleg", admin1: "Arkhangai Province", country: "Mongolia", countryCode: 'MN', lat: 47.475, lon: 101.45417, timezone: 'Asia/Ulaanbaatar', elevation: 1705, population: 21620, aliases: ["Cecerleg"] },
  { id: '2032201', name: "Bulgan", admin1: "Bulgan", country: "Mongolia", countryCode: 'MN', lat: 48.8125, lon: 103.53472, timezone: 'Asia/Ulaanbaatar', elevation: 1204, population: 17348 },
  { id: '7648817', name: "Zuunmod", admin1: "Töv Province", country: "Mongolia", countryCode: 'MN', lat: 47.70693, lon: 106.95276, timezone: 'Asia/Ulaanbaatar', elevation: 1514, population: 16953 },
  { id: '2032614', name: "Baruun-Urt", admin1: "Sükhbaatar Province", country: "Mongolia", countryCode: 'MN', lat: 46.68056, lon: 113.27917, timezone: 'Asia/Ulaanbaatar', elevation: 991, population: 18190 },
  { id: '2030065', name: "Mandalgovi", admin1: "Dundgovi Province", country: "Mongolia", countryCode: 'MN', lat: 45.7625, lon: 106.27083, timezone: 'Asia/Ulaanbaatar', elevation: 1424, population: 12339, aliases: ["Mandalgobi"] },
  { id: '1515029', name: "Ulaangom", admin1: "Uvs Province", country: "Mongolia", countryCode: 'MN', lat: 49.98111, lon: 92.06667, timezone: 'Asia/Hovd', elevation: 935, population: 30092 },
  { id: '1835848', name: "Seoul", admin1: "Seoul", country: "South Korea", countryCode: 'KR', lat: 37.566, lon: 126.9784, timezone: 'Asia/Seoul', elevation: 38, population: 10349312, aliases: ["서울"] },
  { id: '1838524', name: "Busan", admin1: "Busan", country: "South Korea", countryCode: 'KR', lat: 35.10168, lon: 129.03004, timezone: 'Asia/Seoul', elevation: 15, population: 3285147, aliases: ["Pusan", "부산"] },
  { id: '1843564', name: "Incheon", admin1: "Incheon", country: "South Korea", countryCode: 'KR', lat: 37.45646, lon: 126.70515, timezone: 'Asia/Seoul', elevation: 43, population: 3015482 },
  { id: '1835329', name: "Daegu", admin1: "Daegu", country: "South Korea", countryCode: 'KR', lat: 35.87028, lon: 128.59111, timezone: 'Asia/Seoul', elevation: 45, population: 2365523 },
  { id: '1835235', name: "Daejeon", admin1: "Daejeon", country: "South Korea", countryCode: 'KR', lat: 36.34913, lon: 127.38493, timezone: 'Asia/Seoul', elevation: 58, population: 1441203 },
  { id: '1841811', name: "Gwangju", admin1: "Gwangju", country: "South Korea", countryCode: 'KR', lat: 35.15472, lon: 126.91556, timezone: 'Asia/Seoul', elevation: 47, population: 1401235 },
  { id: '1833747', name: "Ulsan", admin1: "Ulsan", country: "South Korea", countryCode: 'KR', lat: 35.53722, lon: 129.31667, timezone: 'Asia/Seoul', elevation: 10, population: 1098421 },
  { id: '1843137', name: "Gangneung", admin1: "Gangwon-do", country: "South Korea", countryCode: 'KR', lat: 37.75266, lon: 128.87239, timezone: 'Asia/Seoul', elevation: 77, population: 208161 },
  { id: '1846266', name: "Jeju", admin1: "Jeju-do", country: "South Korea", countryCode: 'KR', lat: 33.50972, lon: 126.52194, timezone: 'Asia/Seoul', elevation: 19, population: 488844, aliases: ["Jeju City", "Cheju", "제주"] },
  { id: '1845136', name: "Chuncheon", admin1: "Gangwon-do", country: "South Korea", countryCode: 'KR', lat: 37.87472, lon: 127.73417, timezone: 'Asia/Seoul', elevation: 92, population: 284855 },
  { id: '1835553', name: "Suwon", admin1: "Gyeonggi-do", country: "South Korea", countryCode: 'KR', lat: 37.29111, lon: 127.00889, timezone: 'Asia/Seoul', elevation: 58, population: 1234582 },
  { id: '1845457', name: "Jeonju", admin1: "Jeollabuk-do", country: "South Korea", countryCode: 'KR', lat: 35.82194, lon: 127.14889, timezone: 'Asia/Seoul', elevation: 44, population: 638421 },
  { id: '1839071', name: "Pohang", admin1: "Gyeongsangbuk-do", country: "South Korea", countryCode: 'KR', lat: 36.02917, lon: 129.3648, timezone: 'Asia/Seoul', elevation: 5, population: 492041 },
  { id: '1846326', name: "Changwon", admin1: "Gyeongsangnam-do", country: "South Korea", countryCode: 'KR', lat: 35.22806, lon: 128.6811, timezone: 'Asia/Seoul', elevation: 27, population: 1025702 },
  { id: '1845604', name: "Cheongju", admin1: "North Chungcheong", country: "South Korea", countryCode: 'KR', lat: 36.63722, lon: 127.48972, timezone: 'Asia/Seoul', elevation: 49, population: 852147, aliases: ["Cheongju-si"] },
  { id: '1841066', name: "Mokpo", admin1: "Jeollanam-do", country: "South Korea", countryCode: 'KR', lat: 34.81282, lon: 126.39181, timezone: 'Asia/Seoul', elevation: 48, population: 268402 },
  { id: '1846986', name: "Andong", admin1: "Gyeongsangbuk-do", country: "South Korea", countryCode: 'KR', lat: 36.56636, lon: 128.72275, timezone: 'Asia/Seoul', elevation: 103, population: 153348 },
  { id: '1836553', name: "Sokcho", admin1: "Gangwon-do", country: "South Korea", countryCode: 'KR', lat: 38.20701, lon: 128.59181, timezone: 'Asia/Seoul', elevation: 20, population: 81164 },
  { id: '1884138', name: "Yeosu", admin1: "Jeollanam-do", country: "South Korea", countryCode: 'KR', lat: 34.76062, lon: 127.66215, timezone: 'Asia/Seoul', elevation: 10, population: 268823 },
  { id: '6621166', name: "Seogwipo", admin1: "Jeju-do", country: "South Korea", countryCode: 'KR', lat: 33.25333, lon: 126.56181, timezone: 'Asia/Seoul', elevation: 69, population: 178552 },
  { id: '1850147', name: "Tokyo", admin1: "Tokyo", country: "Japan", countryCode: 'JP', lat: 35.6895, lon: 139.69171, timezone: 'Asia/Tokyo', elevation: 44, population: 9733276 },
  { id: '1816670', name: "Beijing", admin1: "Beijing Municipality", country: "China", countryCode: 'CN', lat: 39.9075, lon: 116.39723, timezone: 'Asia/Shanghai', elevation: 49, population: 18960744, aliases: ["Peking"] },
  { id: '1609350', name: "Bangkok", admin1: "Bangkok", country: "Thailand", countryCode: 'TH', lat: 13.75398, lon: 100.50144, timezone: 'Asia/Bangkok', elevation: 12, population: 5104476 },
  { id: '1261481', name: "New Delhi", admin1: "National Capital Territory of Delhi", country: "India", countryCode: 'IN', lat: 28.62137, lon: 77.2148, timezone: 'Asia/Kolkata', elevation: 211, population: 317797 },
  { id: '524901', name: "Moscow", admin1: "Moscow", country: "Russia", countryCode: 'RU', lat: 55.75204, lon: 37.61781, timezone: 'Europe/Moscow', elevation: 155, population: 10381222 },
  { id: '2950159', name: "Berlin", admin1: "State of Berlin", country: "Germany", countryCode: 'DE', lat: 52.52437, lon: 13.41053, timezone: 'Europe/Berlin', elevation: 74, population: 3426354 },
  { id: '2988507', name: "Paris", admin1: "Île-de-France Region", country: "France", countryCode: 'FR', lat: 48.85341, lon: 2.3488, timezone: 'Europe/Paris', elevation: 42, population: 2138551 },
  { id: '2643743', name: "London", admin1: "England", country: "United Kingdom", countryCode: 'GB', lat: 51.50853, lon: -0.12574, timezone: 'Europe/London', elevation: 25, population: 8961989 },
  { id: '4140963', name: "Washington, D.C.", admin1: "District of Columbia", country: "United States", countryCode: 'US', lat: 38.89511, lon: -77.03637, timezone: 'America/New_York', elevation: 7, population: 689545, aliases: ["Washington", "Washington DC"] },
  { id: '2172517', name: "Canberra", admin1: "Australian Capital Territory", country: "Australia", countryCode: 'AU', lat: -35.28346, lon: 149.12807, timezone: 'Australia/Sydney', elevation: 571, population: 367752 },
  { id: '5128581', name: "New York", admin1: "New York", country: "United States", countryCode: 'US', lat: 40.71427, lon: -74.00597, timezone: 'America/New_York', elevation: 10, population: 8804190 },
  { id: '5368361', name: "Los Angeles", admin1: "California", country: "United States", countryCode: 'US', lat: 34.05223, lon: -118.24368, timezone: 'America/Los_Angeles', elevation: 89, population: 3820914 },
  { id: '1880252', name: "Singapore", country: "Singapore", countryCode: 'SG', lat: 1.28967, lon: 103.85007, timezone: 'Asia/Singapore', elevation: 23, population: 5638700 },
  { id: '1819729', name: "Hong Kong", country: null, countryCode: 'HK', lat: 22.27832, lon: 114.17469, timezone: 'Asia/Hong_Kong', elevation: 60, population: 7396076 },
  { id: '1796236', name: "Shanghai", admin1: "Shanghai Municipality", country: "China", countryCode: 'CN', lat: 31.22222, lon: 121.45806, timezone: 'Asia/Shanghai', elevation: 12, population: 24874500 },
  { id: '1853909', name: "Osaka", admin1: "Osaka", country: "Japan", countryCode: 'JP', lat: 34.69379, lon: 135.50107, timezone: 'Asia/Tokyo', elevation: 4, population: 2753862 },
  { id: '2147714', name: "Sydney", admin1: "New South Wales", country: "Australia", countryCode: 'AU', lat: -33.86785, lon: 151.20732, timezone: 'Australia/Sydney', elevation: 58, population: 5557233 },
  { id: '292223', name: "Dubai", admin1: "Dubai", country: "United Arab Emirates", countryCode: 'AE', lat: 25.07725, lon: 55.30927, timezone: 'Asia/Dubai', elevation: 24, population: 3790000 },
  { id: '745044', name: "Istanbul", admin1: "Istanbul", country: "Republic of Türkiye", countryCode: 'TR', lat: 41.01384, lon: 28.94966, timezone: 'Europe/Istanbul', elevation: 39, population: 15701602 },
  { id: '1581130', name: "Hanoi", admin1: "Hanoi", country: "Vietnam", countryCode: 'VN', lat: 21.0245, lon: 105.84117, timezone: 'Asia/Bangkok', elevation: 10, population: 8053663 },
  { id: '1668341', name: "Taipei", admin1: "Taiwan", country: "Taiwan", countryCode: 'TW', lat: 25.05306, lon: 121.52639, timezone: 'Asia/Taipei', elevation: 5, population: 7871900 },
  { id: '6094817', name: "Ottawa", admin1: "Ontario", country: "Canada", countryCode: 'CA', lat: 45.41117, lon: -75.69812, timezone: 'America/Toronto', elevation: 71, population: 1017449 },
  { id: '360630', name: "Cairo", admin1: "Cairo Governorate", country: "Egypt", countryCode: 'EG', lat: 30.06263, lon: 31.24967, timezone: 'Africa/Cairo', elevation: 23, population: 9606916 },
  { id: '3169070', name: "Rome", admin1: "Lazio", country: "Italy", countryCode: 'IT', lat: 41.89193, lon: 12.51133, timezone: 'Europe/Rome', elevation: 20, population: 2318895 },
  { id: '3117735', name: "Madrid", admin1: "Madrid", country: "Spain", countryCode: 'ES', lat: 40.4165, lon: -3.70256, timezone: 'Europe/Madrid', elevation: 665, population: 3255944 },
  { id: '2032007', name: "Dalanzadgad", admin1: "Ömnögovi Province", country: "Mongolia", countryCode: 'MN', lat: 43.57083, lon: 104.425, timezone: 'Asia/Ulaanbaatar', elevation: 1470, population: 24863, aliases: ["Dalandzadgad"] },
  { id: '2032081', name: "Sainshand", admin1: "Dornogovi Province", country: "Mongolia", countryCode: 'MN', lat: 44.88239, lon: 110.11631, timezone: 'Asia/Ulaanbaatar', elevation: 947, population: 19891, aliases: ["Saynshand"] },
  { id: '2032814', name: "Arvaikheer", admin1: "Övörkhangai Province", country: "Mongolia", countryCode: 'MN', lat: 46.26389, lon: 102.775, timezone: 'Asia/Ulaanbaatar', elevation: 1838, population: 29420, aliases: ["Arvayheer"] },
  { id: '2032533', name: "Bayankhongor", admin1: "Bayankhongor Province", country: "Mongolia", countryCode: 'MN', lat: 46.19444, lon: 100.71806, timezone: 'Asia/Ulaanbaatar', elevation: 1873, population: 30931, aliases: ["Bayanhongor"] },
  { id: '2029156', name: "Sükhbaatar", admin1: "Selenge Province", country: "Mongolia", countryCode: 'MN', lat: 50.23139, lon: 106.20778, timezone: 'Asia/Ulaanbaatar', elevation: 619, population: 22741, aliases: ["Suhbaatar", "Sukhbaatar"] },
  { id: '2032050', name: "Choir", admin1: "Govisümber Province", country: "Mongolia", countryCode: 'MN', lat: 46.36111, lon: 108.36111, timezone: 'Asia/Ulaanbaatar', elevation: 1286, population: 10434, aliases: ["Choyr"] },
  { id: '2029656', name: "Öndörkhaan", admin1: "Khentii Province", country: "Mongolia", countryCode: 'MN', lat: 47.31944, lon: 110.65556, timezone: 'Asia/Ulaanbaatar', elevation: 1030, population: 22741, aliases: ["Undurkhaan", "Chinggis", "Chinggis City"] },
];

export const CITY_BY_ID: ReadonlyMap<string, City> = new Map(CITIES.map((c) => [c.id, c]));

export function cityGroup(city: City): CityGroup {
  if (city.countryCode === 'MN') return 'mn';
  if (city.countryCode === 'KR') return 'kr';
  return 'world';
}

export interface NationGroup {
  id: CityGroup;
  label: string;
  /** City ids shown in the /nation snapshot, in display order. */
  cityIds: string[];
}

const idOf = (name: string, countryCode: string): string => {
  const c = CITIES.find((x) => x.name === name && x.countryCode === countryCode);
  if (!c) throw new Error(`City catalogue is missing ${name} (${countryCode})`);
  return c.id;
};

export const NATION_GROUPS: Record<CityGroup, NationGroup> = {
  mn: {
    id: 'mn',
    label: 'Mongolia',
    cityIds: [
      ['Ulaanbaatar', 'MN'], ['Erdenet', 'MN'], ['Darkhan', 'MN'], ['Choibalsan', 'MN'], ['Ölgii', 'MN'],
      ['Khovd', 'MN'], ['Mörön', 'MN'], ['Dalanzadgad', 'MN'], ['Sainshand', 'MN'], ['Arvaikheer', 'MN'],
    ].map(([n, cc]) => idOf(n!, cc!)),
  },
  kr: {
    id: 'kr',
    label: 'South Korea',
    cityIds: [
      ['Seoul', 'KR'], ['Incheon', 'KR'], ['Chuncheon', 'KR'], ['Gangneung', 'KR'], ['Daejeon', 'KR'],
      ['Daegu', 'KR'], ['Gwangju', 'KR'], ['Ulsan', 'KR'], ['Busan', 'KR'], ['Jeju', 'KR'],
    ].map(([n, cc]) => idOf(n!, cc!)),
  },
  world: {
    id: 'world',
    label: 'World',
    cityIds: [
      ['Tokyo', 'JP'], ['Beijing', 'CN'], ['Bangkok', 'TH'], ['New Delhi', 'IN'], ['Moscow', 'RU'],
      ['Berlin', 'DE'], ['Paris', 'FR'], ['London', 'GB'], ['Washington, D.C.', 'US'], ['Canberra', 'AU'],
    ].map(([n, cc]) => idOf(n!, cc!)),
  },
};

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Notification region id, e.g. "mn-ulaanbaatar", "kr-seoul", "us-washington". */
export function regionSlug(city: City): string {
  const base = fold(city.name.split(',')[0]!)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${city.countryCode.toLowerCase()}-${base}`;
}

/** Case- and diacritic-insensitive search over names and aliases (prefix matches rank first). */
export function searchCities(query: string, limit: number): City[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: { city: City; score: number }[] = [];
  for (const city of CITIES) {
    const names = [city.name, ...(city.aliases ?? [])].map(fold);
    let score = 0;
    if (names.some((n) => n === q)) score = 3;
    else if (names.some((n) => n.startsWith(q))) score = 2;
    else if (names.some((n) => n.includes(q))) score = 1;
    if (score > 0) scored.push({ city, score });
  }
  scored.sort((a, b) => b.score - a.score || (b.city.population ?? 0) - (a.city.population ?? 0));
  return scored.slice(0, limit).map((s) => s.city);
}
