"""Data sources: Open-Meteo (live), synthetic generator, and the fallback wrapper."""

from .base import (
    BASE_VARS,
    MEMBERS,
    PRIMARY_MEMBER,
    DataSource,
    HistoricalData,
    LiveForecast,
    UpstreamError,
    available_members,
    col,
)
from .fallback import FallbackDataSource, build_data_source
from .openmeteo import OpenMeteoDataSource
from .synthetic import SyntheticDataSource

__all__ = [
    "BASE_VARS",
    "MEMBERS",
    "PRIMARY_MEMBER",
    "DataSource",
    "FallbackDataSource",
    "HistoricalData",
    "LiveForecast",
    "OpenMeteoDataSource",
    "SyntheticDataSource",
    "UpstreamError",
    "available_members",
    "build_data_source",
    "col",
]
