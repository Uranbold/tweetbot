"""Tiny built-in gazetteer used to name ad-hoc coordinates (nearest city within 50 km)."""

from __future__ import annotations

import math
from dataclasses import dataclass

from .schemas import Location


@dataclass(frozen=True)
class City:
    name: str
    admin1: str
    country: str
    country_code: str
    lat: float
    lon: float
    timezone: str


CITIES: tuple[City, ...] = (
    # Mongolia (aimag centres)
    City("Ulaanbaatar", "Ulaanbaatar", "Mongolia", "MN", 47.92, 106.92, "Asia/Ulaanbaatar"),
    City("Darkhan", "Darkhan-Uul", "Mongolia", "MN", 49.49, 105.92, "Asia/Ulaanbaatar"),
    City("Erdenet", "Orkhon", "Mongolia", "MN", 49.03, 104.08, "Asia/Ulaanbaatar"),
    City("Choibalsan", "Dornod", "Mongolia", "MN", 48.07, 114.53, "Asia/Choibalsan"),
    City("Murun", "Khuvsgul", "Mongolia", "MN", 49.63, 100.16, "Asia/Ulaanbaatar"),
    City("Khovd", "Khovd", "Mongolia", "MN", 48.01, 91.64, "Asia/Hovd"),
    City("Ulgii", "Bayan-Ulgii", "Mongolia", "MN", 48.97, 89.96, "Asia/Hovd"),
    City("Ulaangom", "Uvs", "Mongolia", "MN", 49.98, 92.07, "Asia/Hovd"),
    City("Dalanzadgad", "Umnugovi", "Mongolia", "MN", 43.57, 104.43, "Asia/Ulaanbaatar"),
    City("Sainshand", "Dornogovi", "Mongolia", "MN", 44.89, 110.14, "Asia/Ulaanbaatar"),
    City("Arvaikheer", "Uvurkhangai", "Mongolia", "MN", 46.26, 102.78, "Asia/Ulaanbaatar"),
    City("Bayankhongor", "Bayankhongor", "Mongolia", "MN", 46.19, 100.72, "Asia/Ulaanbaatar"),
    City("Tsetserleg", "Arkhangai", "Mongolia", "MN", 47.48, 101.45, "Asia/Ulaanbaatar"),
    City("Uliastai", "Zavkhan", "Mongolia", "MN", 47.74, 96.84, "Asia/Hovd"),
    City("Altai", "Govi-Altai", "Mongolia", "MN", 46.37, 96.26, "Asia/Hovd"),
    City("Sukhbaatar", "Selenge", "Mongolia", "MN", 50.23, 106.21, "Asia/Ulaanbaatar"),
    City("Zuunmod", "Tuv", "Mongolia", "MN", 47.71, 106.95, "Asia/Ulaanbaatar"),
    City("Baruun-Urt", "Sukhbaatar", "Mongolia", "MN", 46.68, 113.28, "Asia/Ulaanbaatar"),
    City("Undurkhaan", "Khentii", "Mongolia", "MN", 47.32, 110.66, "Asia/Ulaanbaatar"),
    City("Mandalgovi", "Dundgovi", "Mongolia", "MN", 45.76, 106.27, "Asia/Ulaanbaatar"),
    City("Bulgan", "Bulgan", "Mongolia", "MN", 48.81, 103.53, "Asia/Ulaanbaatar"),
    City("Choir", "Govisumber", "Mongolia", "MN", 46.36, 108.36, "Asia/Ulaanbaatar"),
    # Korea
    City("Seoul", "Seoul", "South Korea", "KR", 37.57, 126.98, "Asia/Seoul"),
    City("Busan", "Busan", "South Korea", "KR", 35.18, 129.08, "Asia/Seoul"),
    City("Incheon", "Incheon", "South Korea", "KR", 37.46, 126.71, "Asia/Seoul"),
    City("Daegu", "Daegu", "South Korea", "KR", 35.87, 128.60, "Asia/Seoul"),
    City("Daejeon", "Daejeon", "South Korea", "KR", 36.35, 127.38, "Asia/Seoul"),
    City("Gwangju", "Gwangju", "South Korea", "KR", 35.16, 126.85, "Asia/Seoul"),
    City("Ulsan", "Ulsan", "South Korea", "KR", 35.54, 129.31, "Asia/Seoul"),
    City("Suwon", "Gyeonggi-do", "South Korea", "KR", 37.26, 127.03, "Asia/Seoul"),
    City("Jeju", "Jeju-do", "South Korea", "KR", 33.50, 126.53, "Asia/Seoul"),
    City("Gangneung", "Gangwon-do", "South Korea", "KR", 37.75, 128.88, "Asia/Seoul"),
    City("Chuncheon", "Gangwon-do", "South Korea", "KR", 37.88, 127.73, "Asia/Seoul"),
    City("Jeonju", "Jeollabuk-do", "South Korea", "KR", 35.82, 127.15, "Asia/Seoul"),
    City("Cheongju", "Chungcheongbuk-do", "South Korea", "KR", 36.64, 127.49, "Asia/Seoul"),
    City("Pyongyang", "Pyongyang", "North Korea", "KP", 39.02, 125.75, "Asia/Pyongyang"),
    # World
    City("Tokyo", "Tokyo", "Japan", "JP", 35.68, 139.69, "Asia/Tokyo"),
    City("Beijing", "Beijing", "China", "CN", 39.91, 116.40, "Asia/Shanghai"),
    City("Shanghai", "Shanghai", "China", "CN", 31.23, 121.47, "Asia/Shanghai"),
    City("Hong Kong", "Hong Kong", "China", "HK", 22.32, 114.17, "Asia/Hong_Kong"),
    City("Taipei", "Taipei", "Taiwan", "TW", 25.03, 121.57, "Asia/Taipei"),
    City("Singapore", "Singapore", "Singapore", "SG", 1.35, 103.82, "Asia/Singapore"),
    City("Bangkok", "Bangkok", "Thailand", "TH", 13.76, 100.50, "Asia/Bangkok"),
    City("Delhi", "Delhi", "India", "IN", 28.61, 77.21, "Asia/Kolkata"),
    City("Dubai", "Dubai", "United Arab Emirates", "AE", 25.20, 55.27, "Asia/Dubai"),
    City("Moscow", "Moscow", "Russia", "RU", 55.76, 37.62, "Europe/Moscow"),
    City("Irkutsk", "Irkutsk Oblast", "Russia", "RU", 52.29, 104.30, "Asia/Irkutsk"),
    City("Istanbul", "Istanbul", "Türkiye", "TR", 41.01, 28.98, "Europe/Istanbul"),
    City("Berlin", "Berlin", "Germany", "DE", 52.52, 13.41, "Europe/Berlin"),
    City("Paris", "Île-de-France", "France", "FR", 48.86, 2.35, "Europe/Paris"),
    City("London", "England", "United Kingdom", "GB", 51.51, -0.13, "Europe/London"),
    City("New York", "New York", "United States", "US", 40.71, -74.01, "America/New_York"),
    City("Los Angeles", "California", "United States", "US", 34.05, -118.24, "America/Los_Angeles"),
    City("Chicago", "Illinois", "United States", "US", 41.88, -87.63, "America/Chicago"),
    City("Toronto", "Ontario", "Canada", "CA", 43.65, -79.38, "America/Toronto"),
    City("Mexico City", "CDMX", "Mexico", "MX", 19.43, -99.13, "America/Mexico_City"),
    City("São Paulo", "São Paulo", "Brazil", "BR", -23.55, -46.63, "America/Sao_Paulo"),
    City("Buenos Aires", "Buenos Aires", "Argentina", "AR", -34.60, -58.38, "America/Buenos_Aires"),
    City("Cairo", "Cairo", "Egypt", "EG", 30.04, 31.24, "Africa/Cairo"),
    City("Nairobi", "Nairobi", "Kenya", "KE", -1.29, 36.82, "Africa/Nairobi"),
    City("Johannesburg", "Gauteng", "South Africa", "ZA", -26.20, 28.05, "Africa/Johannesburg"),
    City("Sydney", "New South Wales", "Australia", "AU", -33.87, 151.21, "Australia/Sydney"),
    City("Auckland", "Auckland", "New Zealand", "NZ", -36.85, 174.76, "Pacific/Auckland"),
)

NEAREST_KM = 50.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_city(lat: float, lon: float, max_km: float = NEAREST_KM) -> City | None:
    best: City | None = None
    best_d = max_km
    for c in CITIES:
        d = haversine_km(lat, lon, c.lat, c.lon)
        if d <= best_d:
            best, best_d = c, d
    return best


def coordinate_label(lat: float, lon: float) -> str:
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"{abs(lat):.2f}°{ns} {abs(lon):.2f}°{ew}"


def round_coord(v: float) -> float:
    return round(float(v) + 0.0, 2)


def location_id(lat: float, lon: float) -> str:
    return f"{round_coord(lat):.2f},{round_coord(lon):.2f}"


def nominal_timezone(lat: float, lon: float) -> str:
    """IANA zone guess for ad-hoc coordinates: nearest city, else Etc/GMT±N (sign inverted)."""
    city = nearest_city(lat, lon, max_km=400)
    if city:
        return city.timezone
    offset_h = int(round(lon / 15.0))
    if offset_h == 0:
        return "UTC"
    return f"Etc/GMT{-offset_h:+d}"


def build_location(
    lat: float,
    lon: float,
    timezone: str | None,
    utc_offset_seconds: int | None,
    elevation: float | None = None,
) -> Location:
    rlat, rlon = round_coord(lat), round_coord(lon)
    city = nearest_city(lat, lon)
    tz = timezone or (city.timezone if city else nominal_timezone(lat, lon))
    if utc_offset_seconds is None:
        utc_offset_seconds = _offset_for_zone(tz, lon)
    if city:
        return Location(
            id=location_id(lat, lon),
            name=city.name,
            admin1=city.admin1,
            country=city.country,
            country_code=city.country_code,
            lat=rlat,
            lon=rlon,
            timezone=tz,
            utc_offset_seconds=utc_offset_seconds,
            elevation=elevation,
        )
    return Location(
        id=location_id(lat, lon),
        name=coordinate_label(rlat, rlon),
        country="",
        country_code="",
        lat=rlat,
        lon=rlon,
        timezone=tz,
        utc_offset_seconds=utc_offset_seconds,
        elevation=elevation,
    )


def _offset_for_zone(tz: str, lon: float) -> int:
    try:
        from datetime import datetime
        from zoneinfo import ZoneInfo

        off = datetime.now(ZoneInfo(tz)).utcoffset()
        return int(off.total_seconds()) if off is not None else 0
    except Exception:
        return int(round(lon / 15.0)) * 3600
