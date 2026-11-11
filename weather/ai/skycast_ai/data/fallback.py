"""Live-with-synthetic-fallback composition and the settings-driven factory."""

from __future__ import annotations

import logging
from datetime import date, datetime

from ..settings import Settings
from .base import DataSource, HistoricalData, LiveForecast, UpstreamError
from .openmeteo import OpenMeteoDataSource
from .synthetic import SyntheticDataSource

log = logging.getLogger(__name__)


class FallbackDataSource:
    """Try the live source; on 429 / 5xx / timeout / bad payload use the synthetic one.

    Results coming from the fallback carry ``mock=True`` so the API can surface it in ``meta``.
    """

    name = "auto"

    def __init__(self, live: DataSource, synthetic: DataSource):
        self.live = live
        self.synthetic = synthetic
        self.fallbacks = 0

    def fetch_history(self, lat: float, lon: float, end: date, days: int) -> HistoricalData:
        try:
            return self.live.fetch_history(lat, lon, end, days)
        except UpstreamError as exc:
            self.fallbacks += 1
            log.warning("history upstream failed (%s); using synthetic data", exc)
            out = self.synthetic.fetch_history(lat, lon, end, days)
            out.mock = True
            return out

    def fetch_forecast(self, lat: float, lon: float, now_utc: datetime, hours: int) -> LiveForecast:
        try:
            return self.live.fetch_forecast(lat, lon, now_utc, hours)
        except UpstreamError as exc:
            self.fallbacks += 1
            log.warning("forecast upstream failed (%s); using synthetic data", exc)
            out = self.synthetic.fetch_forecast(lat, lon, now_utc, hours)
            out.mock = True
            return out


def build_data_source(settings: Settings) -> DataSource:
    synthetic = SyntheticDataSource()
    if settings.data_mode == "synthetic":
        return synthetic
    live = OpenMeteoDataSource(
        cache_dir=settings.cache_dir,
        timeout_s=settings.upstream_timeout_s,
        history_ttl_s=settings.history_cache_ttl_s,
        forecast_ttl_s=settings.forecast_cache_ttl_s,
    )
    if settings.data_mode == "live":
        return live
    return FallbackDataSource(live, synthetic)
