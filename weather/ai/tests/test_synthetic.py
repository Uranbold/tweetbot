from __future__ import annotations

import numpy as np
import pandas as pd

from skycast_ai.data.base import BASE_VARS, MEMBERS, available_members, col
from tests.conftest import FIXED_NOW, HISTORY_END, UB


def test_history_is_deterministic(synthetic, ub_history):
    again = synthetic.fetch_history(*UB, HISTORY_END, 365)
    pd.testing.assert_frame_equal(again.obs, ub_history.obs)
    pd.testing.assert_frame_equal(again.nwp, ub_history.nwp)
    assert ub_history.mock is True
    assert ub_history.source == "synthetic"


def test_history_differs_by_location(synthetic, ub_history):
    other = synthetic.fetch_history(37.57, 126.98, HISTORY_END, 365)
    assert not np.allclose(other.obs["temperature_2m"], ub_history.obs["temperature_2m"])


def test_history_shape_and_contiguity(ub_history):
    assert len(ub_history.obs) == 365 * 24
    assert list(ub_history.obs.columns) == list(BASE_VARS)
    diffs = ub_history.obs.index.to_series().diff().dropna().unique()
    assert len(diffs) == 1 and diffs[0] == pd.Timedelta(hours=1)
    assert available_members(ub_history.nwp) == list(MEMBERS)
    assert "lead_hours" in ub_history.nwp.columns


def test_history_physically_plausible(ub_history):
    obs = ub_history.obs
    assert obs["temperature_2m"].between(-60, 50).all()
    assert (obs["precipitation"] >= 0).all()
    assert obs["relative_humidity_2m"].between(0, 100).all()
    assert obs["cloud_cover"].between(0, 100).all()
    assert (obs["wind_speed_10m"] >= 0).all()
    assert obs["surface_pressure"].between(900, 1100).all()
    # high-latitude continental site: real seasonal cycle
    monthly = obs["temperature_2m"].groupby(obs.index.month).mean()
    assert monthly[1] < -5 and monthly[7] > 15


def test_nwp_has_learnable_biases(ub_history):
    obs = ub_history.obs["temperature_2m"]
    fc = ub_history.nwp[col("temperature_2m")]
    err = fc - obs
    month, hour = obs.index.month, obs.index.hour
    winter_night = err[month.isin([12, 1, 2]) & ((hour >= 23) | (hour <= 6))].mean()
    summer_afternoon = err[month.isin([6, 7, 8]) & hour.isin([13, 14, 15, 16])].mean()
    assert winter_night < -0.8, "expected a cold bias on winter nights"
    assert summer_afternoon > 0.2, "expected a warm bias on summer afternoons"
    wet_obs = (ub_history.obs["precipitation"] > 0).mean()
    wet_fc = (ub_history.nwp[col("precipitation")] > 0).mean()
    assert wet_fc > wet_obs, "NWP should be too wet (drizzle bias)"


def test_live_forecast_window(synthetic, ub_forecast):
    nwp = ub_forecast.nwp
    now_local = pd.Timestamp(FIXED_NOW) + pd.Timedelta(seconds=ub_forecast.utc_offset_seconds)
    assert nwp.index[0] == now_local - pd.Timedelta(hours=6)
    assert nwp.index[-1] >= now_local + pd.Timedelta(hours=168)
    assert (nwp["lead_hours"] >= 0).all()
    assert nwp[col("precipitation_probability", "ecmwf_ifs025")].isna().all()
    assert nwp[col("precipitation_probability")].between(0, 100).all()
    again = synthetic.fetch_forecast(*UB, FIXED_NOW, 168)
    pd.testing.assert_frame_equal(again.nwp, nwp)
