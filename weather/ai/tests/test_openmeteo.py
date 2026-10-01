from __future__ import annotations

from datetime import date, datetime

import httpx
import numpy as np
import pandas as pd
import pytest

from skycast_ai.data.base import BASE_VARS, UpstreamError, col
from skycast_ai.data.openmeteo import (
    ARCHIVE_URL,
    FORECAST_URL,
    HISTORICAL_FORECAST_URL,
    OBS_MODEL,
    OpenMeteoDataSource,
    _normalise_hourly,
    _observations_frame,
)
from skycast_ai.models import ClimatologyModel, train_location_model
from tests.conftest import FIXED_NOW, UB


def _payload(times, values: dict, **meta):
    return {
        "latitude": 47.9,
        "longitude": 106.9,
        "elevation": 1302.0,
        "timezone": "Asia/Ulaanbaatar",
        "utc_offset_seconds": 28800,
        "hourly": {"time": times, **values},
        **meta,
    }


def test_normalise_multi_model_and_null_handling():
    times = ["2026-10-01T00:00", "2026-10-01T01:00"]
    df = _normalise_hourly(
        _payload(
            times,
            {
                "temperature_2m_best_match": [1.0, None],
                "temperature_2m_gfs_seamless": [2.0, 3.0],
                "temperature_2m_icon_seamless": [None, None],  # model missing → dropped
                "precipitation_probability_ecmwf_ifs025": [None, None],
                "temperature_2m_ecmwf_ifs025": [0.5, 0.7],
            },
        )
    )
    assert col("temperature_2m") in df and np.isnan(df[col("temperature_2m")].iloc[1])
    assert col("temperature_2m", "gfs_seamless") in df
    assert not any(c.endswith("__icon_seamless") for c in df.columns)
    assert col("precipitation_probability", "ecmwf_ifs025") in df  # kept: ecmwf has temps
    assert isinstance(df.index, pd.DatetimeIndex) and df.index.name == "time"


def test_observations_frame_maps_suffixed_and_plain_keys():
    times = ["2026-10-01T00:00"]
    plain = _observations_frame(_normalise_hourly(_payload(times, {v: [1.0] for v in BASE_VARS})))
    assert list(plain.columns) == list(BASE_VARS)
    suffixed = _observations_frame(
        _normalise_hourly(_payload(times, {f"{v}_{OBS_MODEL}": [2.0] for v in BASE_VARS}))
    )
    assert list(suffixed.columns) == list(BASE_VARS)
    assert (suffixed.iloc[0] == 2.0).all()


def _transport(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_fetch_history_requests_reanalysis_and_members(tmp_path):
    seen: list[httpx.URL] = []
    times = pd.date_range("2026-09-01", periods=48, freq="h").strftime("%Y-%m-%dT%H:%M").tolist()

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url)
        if request.url.host.startswith("archive"):
            vals = {f"{v}_{OBS_MODEL}": [10.0 + i * 0.1 for i in range(48)] for v in BASE_VARS}
        else:
            vals = {}
            for m in ("best_match", "ecmwf_ifs025", "gfs_seamless", "icon_seamless"):
                for v in BASE_VARS:
                    vals[f"{v}_{m}"] = [11.0 + i * 0.1 for i in range(48)]
        return httpx.Response(200, json=_payload(times, vals))

    src = OpenMeteoDataSource(tmp_path, client=_transport(handler))
    hist = src.fetch_history(*UB, date(2026, 9, 2), 2)
    assert len(hist) == 48 and hist.mock is False and hist.elevation == 1302.0
    assert list(hist.obs.columns) == list(BASE_VARS)
    archive = next(u for u in seen if u.host.startswith("archive"))
    forecast = next(u for u in seen if u.host.startswith("historical"))
    assert archive.params["models"] == OBS_MODEL
    assert archive.params["wind_speed_unit"] == "ms" and archive.params["timezone"] == "auto"
    assert forecast.params["models"] == "best_match,ecmwf_ifs025,gfs_seamless,icon_seamless"
    assert (hist.nwp[col("temperature_2m")] - hist.obs["temperature_2m"]).round(6).eq(1.0).all()
    # second call is served from the disk cache
    n = len(seen)
    src.fetch_history(*UB, date(2026, 9, 2), 2)
    assert len(seen) == n and src.cache.hits == 2


def test_fetch_forecast_lead_hours_and_errors(tmp_path):
    times = pd.date_range("2026-10-01", periods=192, freq="h").strftime("%Y-%m-%dT%H:%M").tolist()

    def ok(request):
        vals = {f"temperature_2m_{m}": list(range(192)) for m in ("best_match", "gfs_seamless")}
        vals["precipitation_probability_best_match"] = [10] * 192
        return httpx.Response(200, json=_payload(times, vals))

    src = OpenMeteoDataSource(tmp_path / "a", client=_transport(ok))
    fc = src.fetch_forecast(*UB, datetime(2026, 10, 1, 6), 72)  # 14:00 local
    assert fc.nwp.loc["2026-10-01 14:00", "lead_hours"] == 0.0
    assert fc.nwp.loc["2026-10-01 08:00", "lead_hours"] == 0.0  # past hours clipped
    assert fc.nwp.loc["2026-10-02 14:00", "lead_hours"] == 24.0
    assert fc.timezone == "Asia/Ulaanbaatar" and fc.mock is False

    def limited(request):
        return httpx.Response(429, json={"error": True, "reason": "Daily API request limit exceeded"})

    with pytest.raises(UpstreamError) as exc:
        OpenMeteoDataSource(tmp_path / "b", client=_transport(limited)).fetch_forecast(*UB, FIXED_NOW, 24)
    assert exc.value.status == 429

    def flaky(request):
        raise httpx.ConnectTimeout("slow")

    with pytest.raises(UpstreamError):
        OpenMeteoDataSource(tmp_path / "c", client=_transport(flaky)).fetch_forecast(*UB, FIXED_NOW, 24)

    def rejects_models(request):
        if "models" in request.url.params:
            return httpx.Response(400, json={"error": True, "reason": "Cannot initialize models"})
        return httpx.Response(200, json=_payload(times, {"temperature_2m": list(range(192))}))

    fc2 = OpenMeteoDataSource(tmp_path / "d", client=_transport(rejects_models)).fetch_forecast(
        *UB, FIXED_NOW, 24
    )
    assert col("temperature_2m") in fc2.nwp.columns  # retried without `models`


def test_identical_obs_and_forecast_do_not_train(ub_history):
    """Regression: archive best_match == historical-forecast best_match must not yield a 0 °C MAE model."""
    degenerate = type(ub_history)(
        obs=ub_history.nwp[[col(v) for v in BASE_VARS]].rename(columns={col(v): v for v in BASE_VARS}),
        nwp=ub_history.nwp,
        timezone=ub_history.timezone,
        utc_offset_seconds=ub_history.utc_offset_seconds,
        source="open-meteo",
    )
    model = train_location_model(degenerate, *UB, key="degenerate", now_utc=FIXED_NOW)
    assert isinstance(model, ClimatologyModel)
    assert "identical" in model.reason


def test_urls_are_the_documented_endpoints():
    assert ARCHIVE_URL == "https://archive-api.open-meteo.com/v1/archive"
    assert HISTORICAL_FORECAST_URL == "https://historical-forecast-api.open-meteo.com/v1/forecast"
    assert FORECAST_URL == "https://api.open-meteo.com/v1/forecast"
