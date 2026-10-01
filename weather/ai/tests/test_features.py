from __future__ import annotations

import numpy as np
import pandas as pd

from skycast_ai.data.base import col
from skycast_ai.features import FEATURE_LABELS, FEATURE_NAMES, blend_temperature, build_features
from tests.conftest import UB


def test_feature_matrix_shape_and_no_nans(ub_history):
    feats = build_features(ub_history.nwp, {}, UB[0])
    assert feats.shape == (len(ub_history.nwp), len(FEATURE_NAMES))
    assert list(feats.columns) == list(FEATURE_NAMES)
    assert not feats.isna().any().any()
    assert set(FEATURE_LABELS) == set(FEATURE_NAMES)


def test_cyclical_and_lag_features(ub_history):
    feats = build_features(ub_history.nwp, {}, UB[0])
    assert np.allclose(feats["hour_sin"] ** 2 + feats["hour_cos"] ** 2, 1.0)
    assert np.allclose(feats["doy_sin"] ** 2 + feats["doy_cos"] ** 2, 1.0)
    blend = feats["nwp_temp_blend"].to_numpy()
    assert np.allclose(feats["nwp_temp_lag1"].to_numpy()[1:], blend[:-1])
    assert np.allclose(feats["nwp_temp_lag6"].to_numpy()[6:], blend[:-6])
    assert (feats["lat"] == UB[0]).all()
    assert (feats["ens_members"] == 4).all()
    assert (feats["ens_spread"] > 0).mean() > 0.99


def test_blend_weights_respected(ub_history):
    nwp = ub_history.nwp
    only_gfs = blend_temperature(nwp, {"gfs_seamless": 1.0})
    assert np.allclose(only_gfs, nwp[col("temperature_2m", "gfs_seamless")])
    equal = blend_temperature(nwp, {})
    mean = nwp[
        [col("temperature_2m", m) for m in ("best_match", "ecmwf_ifs025", "gfs_seamless", "icon_seamless")]
    ].mean(axis=1)
    assert np.allclose(equal, mean)


def test_single_member_frame_works():
    idx = pd.date_range("2026-01-01", periods=48, freq="h", name="time")
    nwp = pd.DataFrame(
        {col("temperature_2m"): np.linspace(-10, 5, 48), "lead_hours": np.arange(48)}, index=idx
    )
    feats = build_features(nwp, {}, 10.0)
    assert feats.shape == (48, len(FEATURE_NAMES))
    assert (feats["ens_spread"] == 0).all()
    assert (feats["nwp_pressure"] == 1013.0).all()
