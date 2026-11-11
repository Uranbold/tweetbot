from __future__ import annotations

import time
from datetime import date, timedelta

import numpy as np
import pandas as pd

from skycast_ai.data.base import HistoricalData
from skycast_ai.models import ClimatologyModel, ModelStore, TrainedModel, train_location_model
from tests.conftest import FIXED_NOW, UB


def test_training_beats_raw_nwp(ub_model):
    assert isinstance(ub_model, TrainedModel)
    assert ub_model.training_samples == 8760
    m = ub_model.metrics
    assert m["temperature_mae"] < m["temperature_mae_nwp"], m
    assert m["temperature_mae"] < ub_model.diagnostics["mae_blend_uncorrected"] + 1e-9
    assert 0 < m["precipitation_brier"] < 0.25
    assert ub_model.algorithm == "ensemble-blend"
    assert ub_model.regressor_kind in ("gradient-boosting", "ridge")
    assert abs(sum(ub_model.weights.values()) - 1.0) < 1e-3
    # the deliberately-worst synthetic member gets the smallest weight
    assert ub_model.weights["gfs_seamless"] == min(ub_model.weights.values())


def test_training_is_fast(ub_history):
    t0 = time.perf_counter()
    train_location_model(ub_history, *UB, key="timing", now_utc=FIXED_NOW)
    assert time.perf_counter() - t0 < 10.0


def test_prediction_quantiles_ordered_and_bounded(ub_model, ub_forecast):
    pred = ub_model.predict(ub_forecast.nwp)
    assert len(pred) == len(ub_forecast.nwp)
    assert (pred["temperature_p10"] <= pred["temperature"]).all()
    assert (pred["temperature"] <= pred["temperature_p90"]).all()
    assert pred["precipitation_probability"].between(0, 1).all()
    assert (pred["precipitation"] >= 0).all()
    # uncertainty widens with lead time
    width = pred["temperature_p90"] - pred["temperature_p10"]
    assert width.iloc[-24:].mean() > width.iloc[6:30].mean()


def test_store_roundtrip(tmp_path, ub_model):
    clock = lambda: FIXED_NOW  # noqa: E731
    store = ModelStore(tmp_path, ttl_s=3600, clock=clock)
    store.put("k", ub_model)
    fresh = ModelStore(tmp_path, ttl_s=3600, clock=clock)  # new process-like instance → loads from disk
    loaded = fresh.get("k")
    assert isinstance(loaded, TrainedModel)
    assert loaded.metrics == ub_model.metrics
    expired = ModelStore(tmp_path, ttl_s=-1, mock_ttl_s=-1, clock=clock)
    assert expired.get("k") is None
    assert expired.get("k", allow_stale=True) is not None
    # a synthetic-trained (mock) model uses the shorter mock TTL so live data gets picked up again
    later = ModelStore(tmp_path, ttl_s=10**6, mock_ttl_s=60, clock=lambda: FIXED_NOW + timedelta(hours=1))
    assert later.get("k") is None


def test_climatology_fallback_on_tiny_data(synthetic):
    hist = synthetic.fetch_history(*UB, date(2026, 9, 24), 10)
    model = train_location_model(hist, *UB, key="tiny", now_utc=FIXED_NOW)
    assert isinstance(model, ClimatologyModel)
    assert model.training_samples == 0
    assert model.algorithm == "climatology-fallback"
    fc = synthetic.fetch_forecast(*UB, FIXED_NOW, 72)
    pred = model.predict(fc.nwp)
    assert (pred["temperature_p10"] < pred["temperature"]).all()
    assert (pred["temperature"] < pred["temperature_p90"]).all()


def test_training_error_falls_back(ub_history):
    broken = HistoricalData(
        obs=ub_history.obs.iloc[:0],
        nwp=pd.DataFrame(index=ub_history.nwp.index[:0]),
        timezone="UTC",
        utc_offset_seconds=0,
    )
    model = train_location_model(broken, *UB, key="broken", now_utc=FIXED_NOW)
    assert isinstance(model, ClimatologyModel)
    assert model.training_samples == 0 and model.reason
    assert not np.isnan(model.default_sigma)
