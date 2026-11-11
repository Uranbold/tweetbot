"""Open-Meteo client: historical archive (obs), historical forecast (what NWP said) and live
multi-model forecast. Raw JSON responses are cached on disk with a TTL."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx
import numpy as np
import pandas as pd

from .base import (
    BASE_VARS,
    LIVE_EXTRA_VARS,
    MEMBERS,
    PRIMARY_MEMBER,
    HistoricalData,
    LiveForecast,
    UpstreamError,
    col,
)
from .cache import DiskCache

log = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORICAL_FORECAST_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

NAME = "open-meteo"
OBS_MODEL = "era5_seamless"  # ERA5 + ERA5-Land reanalysis (~5 day lag), never an archived forecast


def _observations_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Reduce a normalised archive frame to plain BASE_VARS columns.

    The archive returns ``temperature_2m`` for a single default model, but ``temperature_2m_era5_seamless``
    when a model is named; both end up here as ``<key>__best_match`` and are mapped by prefix.
    """
    out: dict[str, pd.Series] = {}
    for c in df.columns:
        key = c.split("__", 1)[0]
        for var in sorted(BASE_VARS, key=len, reverse=True):
            if key == var or key.startswith(var + "_"):
                out.setdefault(var, df[c])
                break
    return pd.DataFrame(out, index=df.index)[[v for v in BASE_VARS if v in out]]


def _normalise_hourly(payload: dict) -> pd.DataFrame:
    """Flatten Open-Meteo ``hourly`` into ``var__member`` columns with a naive local index."""
    hourly = payload.get("hourly") or {}
    times = hourly.get("time")
    if not times:
        raise UpstreamError("upstream payload has no hourly.time")
    index = pd.DatetimeIndex(pd.to_datetime(times), name="time")
    data: dict[str, np.ndarray] = {}
    suffixes = sorted((m for m in MEMBERS), key=len, reverse=True)
    for key, values in hourly.items():
        if key == "time":
            continue
        var, member = key, PRIMARY_MEMBER
        for m in suffixes:
            if key.endswith("_" + m):
                var, member = key[: -(len(m) + 1)], m
                break
        arr = np.array([np.nan if v is None else v for v in values], dtype=float)
        if len(arr) != len(index):
            raise UpstreamError(f"upstream column {key} has {len(arr)} values for {len(index)} times")
        data[col(var, member)] = arr
    df = pd.DataFrame(data, index=index)
    # drop members that are entirely empty for temperature (model not available for this place/time)
    for m in MEMBERS:
        c = col("temperature_2m", m)
        if c in df.columns and df[c].notna().sum() == 0:
            df = df.drop(columns=[x for x in df.columns if x.endswith("__" + m)])
    return df


class OpenMeteoDataSource:
    name = NAME

    def __init__(
        self,
        cache_dir: Path,
        timeout_s: float = 6.0,
        history_ttl_s: int = 24 * 3600,
        forecast_ttl_s: int = 3600,
        client: httpx.Client | None = None,
    ):
        self.cache = DiskCache(cache_dir)
        self.timeout_s = timeout_s
        self.history_ttl_s = history_ttl_s
        self.forecast_ttl_s = forecast_ttl_s
        self._client = client

    # ------------------------------------------------------------------ HTTP
    def _get(self, url: str, params: dict, ttl_s: int) -> dict:
        key = DiskCache.key_for(url, params)
        cached = self.cache.get(key, ttl_s)
        if cached is not None:
            return cached
        try:
            client = self._client or httpx.Client(timeout=self.timeout_s)
            try:
                resp = client.get(url, params=params)
            finally:
                if self._client is None:
                    client.close()
        except httpx.TimeoutException as exc:
            raise UpstreamError(f"timeout calling {url}: {exc}") from exc
        except httpx.HTTPError as exc:
            raise UpstreamError(f"network error calling {url}: {exc}") from exc
        if resp.status_code == 429:
            raise UpstreamError("Open-Meteo rate limit exceeded (HTTP 429)", status=429)
        if resp.status_code >= 500:
            raise UpstreamError(f"Open-Meteo server error HTTP {resp.status_code}", status=resp.status_code)
        if resp.status_code >= 400:
            reason = ""
            try:
                reason = resp.json().get("reason", "")
            except Exception:
                pass
            raise UpstreamError(
                f"Open-Meteo rejected request (HTTP {resp.status_code}): {reason}", status=resp.status_code
            )
        try:
            payload = resp.json()
        except ValueError as exc:
            raise UpstreamError("Open-Meteo returned invalid JSON") from exc
        if not isinstance(payload, dict) or "hourly" not in payload:
            raise UpstreamError("Open-Meteo payload missing hourly block")
        self.cache.set(key, payload)
        return payload

    def _get_with_models(self, url: str, params: dict, ttl_s: int, models: str | None = None) -> dict:
        """Request specific model output; if the endpoint rejects ``models``, retry without it."""
        try:
            return self._get(url, {**params, "models": models or ",".join(MEMBERS)}, ttl_s)
        except UpstreamError as exc:
            if exc.status is not None and 400 <= exc.status < 500 and exc.status != 429:
                log.warning("multi-model request rejected (%s); retrying with best_match only", exc)
                return self._get(url, params, ttl_s)
            raise

    # --------------------------------------------------------------- public
    def fetch_history(self, lat: float, lon: float, end: date, days: int) -> HistoricalData:
        start = end - timedelta(days=days - 1)
        base = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "hourly": ",".join(BASE_VARS),
            "timezone": "auto",
            "wind_speed_unit": "ms",
        }
        # Ask the archive for a *reanalysis* explicitly. Its default "best_match" serves recent
        # periods from the archived ECMWF IFS HRES run — the very same series the historical-forecast
        # API's best_match resolves to — which makes the residual identically zero.
        obs_payload = self._get_with_models(ARCHIVE_URL, base, self.history_ttl_s, models=OBS_MODEL)
        fc_payload = self._get_with_models(HISTORICAL_FORECAST_URL, base, self.history_ttl_s)

        obs = _observations_frame(_normalise_hourly(obs_payload))
        nwp = _normalise_hourly(fc_payload)
        common = obs.index.intersection(nwp.index)
        obs, nwp = obs.loc[common], nwp.loc[common]
        nwp = nwp.copy()
        nwp["lead_hours"] = nwp.index.hour.to_numpy().astype(float)
        return HistoricalData(
            obs=obs,
            nwp=nwp,
            timezone=str(obs_payload.get("timezone") or "UTC"),
            utc_offset_seconds=int(obs_payload.get("utc_offset_seconds") or 0),
            elevation=_float_or_none(obs_payload.get("elevation")),
            mock=False,
            source=NAME,
        )

    def fetch_forecast(self, lat: float, lon: float, now_utc: datetime, hours: int) -> LiveForecast:
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "hourly": ",".join(BASE_VARS + LIVE_EXTRA_VARS),
            "forecast_days": 8,
            "timezone": "auto",
            "wind_speed_unit": "ms",
        }
        payload = self._get_with_models(FORECAST_URL, params, self.forecast_ttl_s)
        nwp = _normalise_hourly(payload)
        offset = int(payload.get("utc_offset_seconds") or 0)
        now_local = (now_utc.replace(tzinfo=None) + timedelta(seconds=offset)).replace(
            minute=0, second=0, microsecond=0
        )
        nwp = nwp.copy()
        nwp["lead_hours"] = np.clip(
            ((nwp.index - now_local) / pd.Timedelta(hours=1)).to_numpy().astype(float), 0, None
        )
        return LiveForecast(
            nwp=nwp,
            timezone=str(payload.get("timezone") or "UTC"),
            utc_offset_seconds=offset,
            fetched_at=now_utc,
            elevation=_float_or_none(payload.get("elevation")),
            mock=False,
            source=NAME,
        )


def _float_or_none(v) -> float | None:
    try:
        return None if v is None else float(v)
    except (TypeError, ValueError):
        return None
