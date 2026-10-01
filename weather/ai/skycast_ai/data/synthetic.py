"""Deterministic synthetic weather generator.

Used when Open-Meteo is unavailable (HTTP 429 from a shared IP is common) and in tests.
It produces a physically *plausible* (not realistic) hourly series for a location:

* seasonal cycle whose amplitude grows with latitude (continental winters), hemisphere-aware,
* diurnal cycle damped by cloud cover,
* AR(1) synoptic anomalies, cloud, humidity, wind and pressure processes,
* precipitation driven by cloud/humidity through a Gaussian copula so wet hours cluster,
* four NWP "members" derived from the truth with *systematic* biases the model can learn:
  a night-time cold bias in winter, a warm bias under heavy cloud, a warm afternoon bias in
  summer, too-wet drizzle, and random error that grows with lead time.

Everything is seeded from the rounded lat/lon so repeated calls are identical.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache

import numpy as np
import pandas as pd

from ..locations import nominal_timezone
from .base import BASE_VARS, MEMBERS, HistoricalData, LiveForecast, col

NAME = "synthetic"


@dataclass(frozen=True)
class MemberSpec:
    bias_scale: float
    noise_scale: float
    offset: float
    has_precip_prob: bool


MEMBER_SPECS: dict[str, MemberSpec] = {
    "best_match": MemberSpec(1.0, 1.0, 0.0, True),
    "ecmwf_ifs025": MemberSpec(0.7, 0.8, 0.2, False),  # best member, no precip prob (as in reality)
    "gfs_seamless": MemberSpec(1.2, 1.3, 0.6, True),
    "icon_seamless": MemberSpec(1.0, 1.05, -0.3, True),
}


def _seed(*parts: object) -> int:
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).digest()
    return int.from_bytes(h[:8], "little") % (2**63 - 1)


def _ar1(rng: np.random.Generator, n: int, phi: float, sd: float) -> np.ndarray:
    """Stationary AR(1) process with marginal standard deviation ``sd``."""
    e = rng.normal(0.0, sd * np.sqrt(1.0 - phi * phi), size=n)
    x = np.empty(n)
    x[0] = rng.normal(0.0, sd)
    for i in range(1, n):
        x[i] = phi * x[i - 1] + e[i]
    return x


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def _cycles(index: pd.DatetimeIndex, lat: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    hour = index.hour.to_numpy() + index.minute.to_numpy() / 60.0
    doy = index.dayofyear.to_numpy().astype(float)
    hemi = 1.0 if lat >= 0 else -1.0
    season = -np.cos(2 * np.pi * (doy - 15) / 365.25) * hemi  # -1 mid-winter, +1 mid-summer
    return hour, doy, season


@lru_cache(maxsize=64)
def _truth(lat: float, lon: float, anchor_year: int, n_years: int) -> pd.DataFrame:
    """Hourly 'observations' for [anchor_year-01-01, anchor_year+n_years-01-01)."""
    start = datetime(anchor_year, 1, 1)
    end = datetime(anchor_year + n_years, 1, 1)
    index = pd.date_range(start, end, freq="h", inclusive="left", name="time")
    n = len(index)
    rng = np.random.default_rng(_seed("truth", lat, lon))
    hour, _doy, season = _cycles(index, lat)
    alat = abs(lat)

    # --- cloud (logit AR) : clearer winters at high latitude (continental) ---
    z = _ar1(rng, n, 0.92, 1.3)
    z0 = 0.2 - 0.5 * (alat / 50.0) * np.clip(-season, 0, 1)
    cloud = 100.0 * _sigmoid(z0 + z)

    # --- temperature ---
    t_mean = 28.0 - 0.55 * alat + 2.0 * np.sin(np.radians(lon))
    amp = 2.0 + 0.35 * alat
    t_season = t_mean + amp * season
    diurnal_amp = 3.0 + 4.0 * (1.0 - cloud / 100.0)
    t_diurnal = -diurnal_amp * np.cos(2 * np.pi * (hour - 15) / 24.0)
    anomaly = _ar1(rng, n, 0.98, 4.0)
    temperature = t_season + t_diurnal + anomaly + rng.normal(0, 0.4, n)

    # --- humidity ---
    rh = 72.0 - 1.2 * t_diurnal + 25.0 * (cloud / 100.0 - 0.5) + _ar1(rng, n, 0.9, 10.0)
    rh = np.clip(rh, 8.0, 100.0)

    # --- precipitation via Gaussian copula on an AR latent ---
    latent = _ar1(rng, n, 0.85, 1.0)
    u = 0.5 * (1.0 + _erf(latent / np.sqrt(2.0)))
    logit_p = -2.4 + 3.0 * (cloud / 100.0 - 0.5) + 1.5 * (rh - 70.0) / 20.0 + 0.8 * season
    p_rain = _sigmoid(logit_p)
    wet = u < p_rain
    scale = 0.6 + 1.4 * np.clip(season, 0, 1)
    amount = rng.exponential(1.0, n) * scale
    precipitation = np.where(wet, np.round(amount, 2), 0.0)

    # --- wind & pressure ---
    spring = np.clip(np.sin(2 * np.pi * (_doy - 100) / 365.25), 0, 1)
    wind = np.abs(2.5 + 1.2 * spring + 1.8 * _ar1(rng, n, 0.9, 1.0))
    pressure = 1013.0 - 8.0 * season + _ar1(rng, n, 0.97, 7.0)

    df = pd.DataFrame(
        {
            "temperature_2m": temperature,
            "relative_humidity_2m": rh,
            "precipitation": precipitation,
            "wind_speed_10m": wind,
            "surface_pressure": pressure,
            "cloud_cover": cloud,
        },
        index=index,
    )
    return df.round(2)


def _erf(x: np.ndarray) -> np.ndarray:
    # Abramowitz-Stegun 7.1.26 (max error 1.5e-7) — avoids a scipy dependency.
    sign = np.sign(x)
    ax = np.abs(x)
    t = 1.0 / (1.0 + 0.3275911 * ax)
    poly = t * (
        0.254829592
        + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))
    )
    return sign * (1.0 - poly * np.exp(-ax * ax))


def _members(
    lat: float,
    lon: float,
    truth: pd.DataFrame,
    lead_hours: np.ndarray,
    live: bool,
) -> pd.DataFrame:
    """Derive NWP member forecasts from the truth with learnable systematic biases."""
    n = len(truth)
    index = truth.index
    hour, _doy, season = _cycles(index, lat)
    winter = np.clip(-season, 0, 1)
    summer = np.clip(season, 0, 1)
    night = np.clip(np.cos(2 * np.pi * (hour - 3) / 24.0), 0, 1)  # peaks 03:00, zero 09–21
    afternoon = np.clip(np.cos(2 * np.pi * (hour - 15) / 24.0), 0, 1)
    cloud = truth["cloud_cover"].to_numpy()
    temp = truth["temperature_2m"].to_numpy()
    precip = truth["precipitation"].to_numpy()

    systematic = (
        -2.2 * winter * night
        - 0.3 * winter * (1 - night)
        + 0.7 * summer * afternoon
        + 1.0 * (cloud / 100.0 - 0.5)
    )
    sigma_lead = 0.9 + 0.035 * np.asarray(lead_hours, dtype=float)

    common_rng = np.random.default_rng(_seed("common", lat, lon, live))
    e_common = _ar1(common_rng, n, 0.9, 1.0)

    out: dict[str, np.ndarray] = {}
    for m in MEMBERS:
        spec = MEMBER_SPECS[m]
        rng = np.random.default_rng(_seed("member", m, lat, lon, live))
        e_own = _ar1(rng, n, 0.9, 1.0)
        err = sigma_lead * spec.noise_scale * (np.sqrt(0.5) * e_common + np.sqrt(0.5) * e_own)
        out[col("temperature_2m", m)] = temp + spec.bias_scale * systematic + spec.offset + err

        # too-wet drizzle + occasional misses
        mult = np.exp(rng.normal(-0.2, 0.5, n))
        drizzle_mask = (cloud > 55) & (precip == 0) & (rng.random(n) < 0.35)
        drizzle = np.where(drizzle_mask, rng.uniform(0.1, 0.6, n), 0.0)
        missed = (precip > 0) & (rng.random(n) < 0.15)
        p_m = np.where(missed, 0.0, precip * 0.8 * mult) + drizzle
        out[col("precipitation", m)] = np.round(np.clip(p_m, 0, None), 2)

        out[col("relative_humidity_2m", m)] = np.clip(
            truth["relative_humidity_2m"].to_numpy() + 5.0 + rng.normal(0, 8, n), 0, 100
        )
        out[col("wind_speed_10m", m)] = np.abs(
            truth["wind_speed_10m"].to_numpy() * 1.1 + rng.normal(0, 1.0, n)
        )
        out[col("surface_pressure", m)] = truth["surface_pressure"].to_numpy() + rng.normal(
            0, 1.5, n
        )
        out[col("cloud_cover", m)] = np.clip(cloud + rng.normal(0, 18, n), 0, 100)
        if live:
            if spec.has_precip_prob:
                pp = 100.0 * (1 - np.exp(-p_m / 0.8)) + rng.normal(0, 10, n) + 15.0 * (cloud > 60)
                out[col("precipitation_probability", m)] = np.clip(np.round(pp), 0, 100)
            else:
                out[col("precipitation_probability", m)] = np.full(n, np.nan)

    df = pd.DataFrame(out, index=index)
    df["lead_hours"] = np.asarray(lead_hours, dtype=float)
    return df.round(2)


def _offset_seconds(tz: str, lon: float) -> int:
    try:
        from zoneinfo import ZoneInfo

        off = datetime.now(ZoneInfo(tz)).utcoffset()
        return int(off.total_seconds()) if off is not None else 0
    except Exception:
        return int(round(lon / 15.0)) * 3600


class SyntheticDataSource:
    """Deterministic, offline stand-in for the Open-Meteo trio of endpoints."""

    name = NAME

    def _anchor(self, year: int) -> tuple[int, int]:
        return year - 2, 4  # four calendar years around the request

    def _truth_for(self, lat: float, lon: float, start: datetime, end: datetime) -> pd.DataFrame:
        rlat, rlon = round(float(lat), 2), round(float(lon), 2)
        anchor_year, n_years = self._anchor(end.year)
        if start.year < anchor_year:
            anchor_year = start.year
            n_years = end.year - start.year + 1
        truth = _truth(rlat, rlon, anchor_year, n_years)
        return truth.loc[(truth.index >= start) & (truth.index <= end)]

    def fetch_history(self, lat: float, lon: float, end: date, days: int) -> HistoricalData:
        start_dt = datetime.combine(end - timedelta(days=days - 1), datetime.min.time())
        end_dt = datetime.combine(end, datetime.min.time()) + timedelta(hours=23)
        truth = self._truth_for(lat, lon, start_dt, end_dt)
        lead = truth.index.hour.to_numpy().astype(float)  # one 00Z-style run per day
        nwp = _members(round(lat, 2), round(lon, 2), truth, lead, live=False)
        tz = nominal_timezone(lat, lon)
        return HistoricalData(
            obs=truth[list(BASE_VARS)].copy(),
            nwp=nwp,
            timezone=tz,
            utc_offset_seconds=_offset_seconds(tz, lon),
            elevation=None,
            mock=True,
            source=NAME,
        )

    def fetch_forecast(self, lat: float, lon: float, now_utc: datetime, hours: int) -> LiveForecast:
        tz = nominal_timezone(lat, lon)
        offset = _offset_seconds(tz, lon)
        now_local = (now_utc.replace(tzinfo=None) + timedelta(seconds=offset)).replace(
            minute=0, second=0, microsecond=0
        )
        start = now_local - timedelta(hours=6)
        end = now_local + timedelta(hours=hours + 1)
        truth = self._truth_for(lat, lon, start, end)
        lead = ((truth.index - now_local) / pd.Timedelta(hours=1)).to_numpy().astype(float)
        nwp = _members(round(lat, 2), round(lon, 2), truth, np.clip(lead, 0, None), live=True)
        return LiveForecast(
            nwp=nwp,
            timezone=tz,
            utc_offset_seconds=offset,
            fetched_at=now_utc,
            elevation=None,
            mock=True,
            source=NAME,
        )
