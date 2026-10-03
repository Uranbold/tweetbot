"""Shared data-source types.

Frames use a naive local-wall-clock DatetimeIndex named ``time`` (the contract's convention).
NWP frames are flat: one column per ``<variable>__<member>``, e.g. ``temperature_2m__gfs_seamless``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Protocol

import pandas as pd

BASE_VARS: tuple[str, ...] = (
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "surface_pressure",
    "cloud_cover",
)
LIVE_EXTRA_VARS: tuple[str, ...] = ("precipitation_probability",)

PRIMARY_MEMBER = "best_match"
MEMBERS: tuple[str, ...] = (PRIMARY_MEMBER, "ecmwf_ifs025", "gfs_seamless", "icon_seamless")

MEMBER_LABELS = {
    "best_match": "Open-Meteo best match",
    "ecmwf_ifs025": "ECMWF IFS 0.25°",
    "gfs_seamless": "NOAA GFS",
    "icon_seamless": "DWD ICON",
}


def col(var: str, member: str = PRIMARY_MEMBER) -> str:
    return f"{var}__{member}"


def available_members(df: pd.DataFrame, var: str = "temperature_2m") -> list[str]:
    """Members that have a non-empty column for ``var`` (in canonical order)."""
    out = []
    for m in MEMBERS:
        c = col(var, m)
        if c in df.columns and df[c].notna().sum() > 0:
            out.append(m)
    return out


class UpstreamError(RuntimeError):
    """Raised by a live source when the upstream cannot be used (429, 5xx, timeout, bad JSON)."""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


@dataclass
class HistoricalData:
    """Observations (reanalysis) + the NWP forecasts that were issued for the same hours."""

    obs: pd.DataFrame  # columns: BASE_VARS
    nwp: pd.DataFrame  # columns: var__member (+ lead_hours)
    timezone: str
    utc_offset_seconds: int
    elevation: float | None = None
    mock: bool = False
    source: str = "unknown"

    def __len__(self) -> int:
        return len(self.obs)


@dataclass
class LiveForecast:
    nwp: pd.DataFrame  # columns: var__member incl. precipitation_probability, + lead_hours
    timezone: str
    utc_offset_seconds: int
    fetched_at: datetime
    elevation: float | None = None
    mock: bool = False
    source: str = "unknown"
    extra: dict = field(default_factory=dict)


class DataSource(Protocol):
    name: str

    def fetch_history(self, lat: float, lon: float, end: date, days: int) -> HistoricalData: ...

    def fetch_forecast(self, lat: float, lon: float, now_utc: datetime, hours: int) -> LiveForecast: ...
