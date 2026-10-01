"""Feature engineering shared by training and inference.

Input: an NWP frame (``var__member`` columns + ``lead_hours``) with a naive local DatetimeIndex.
Output: a numeric DataFrame with exactly ``FEATURE_NAMES`` columns and no NaNs.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .data.base import MEMBERS, PRIMARY_MEMBER, available_members, col

FEATURE_NAMES: tuple[str, ...] = (
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
    "nwp_temp_blend",
    "nwp_temp_primary",
    "nwp_humidity",
    "nwp_wind",
    "nwp_pressure",
    "nwp_cloud",
    "nwp_precip",
    "lead_hours",
    "ens_mean",
    "ens_spread",
    "ens_members",
    "nwp_temp_lag1",
    "nwp_temp_lag3",
    "nwp_temp_lag6",
    "lat",
)

FEATURE_LABELS: dict[str, str] = {
    "hour_sin": "hour of day (sin)",
    "hour_cos": "hour of day (cos)",
    "doy_sin": "day of year (sin)",
    "doy_cos": "day of year (cos)",
    "nwp_temp_blend": "NWP temperature (weighted ensemble blend)",
    "nwp_temp_primary": "NWP temperature (best-match model)",
    "nwp_humidity": "NWP relative humidity",
    "nwp_wind": "NWP wind speed",
    "nwp_pressure": "NWP surface pressure",
    "nwp_cloud": "NWP cloud cover",
    "nwp_precip": "NWP precipitation (ensemble mean)",
    "lead_hours": "forecast lead time",
    "ens_mean": "ensemble mean temperature",
    "ens_spread": "ensemble temperature spread",
    "ens_members": "number of ensemble members",
    "nwp_temp_lag1": "NWP temperature t-1h",
    "nwp_temp_lag3": "NWP temperature t-3h",
    "nwp_temp_lag6": "NWP temperature t-6h",
    "lat": "latitude (elevation/climate proxy)",
}


def member_matrix(nwp: pd.DataFrame, var: str, members: list[str] | None = None) -> pd.DataFrame:
    """Columns = members (that exist for ``var``), rows = time; NaNs filled from the row mean."""
    members = members or available_members(nwp, var)
    cols = [col(var, m) for m in members if col(var, m) in nwp.columns]
    if not cols:
        return pd.DataFrame(index=nwp.index)
    mat = nwp[cols].copy()
    mat.columns = [c.split("__", 1)[1] for c in cols]
    row_mean = mat.mean(axis=1)
    for c in mat.columns:
        mat[c] = mat[c].fillna(row_mean)
    return mat


def blend_temperature(nwp: pd.DataFrame, weights: dict[str, float]) -> pd.Series:
    """Weighted mean of member temperatures, renormalising over the members present."""
    mat = member_matrix(nwp, "temperature_2m")
    if mat.empty:
        raise ValueError("no temperature members in NWP frame")
    w = np.array([weights.get(m, 0.0) for m in mat.columns], dtype=float)
    if w.sum() <= 0:
        w = np.ones(len(mat.columns))
    w = w / w.sum()
    return pd.Series(mat.to_numpy() @ w, index=nwp.index, name="nwp_temp_blend")


def primary_series(nwp: pd.DataFrame, var: str) -> pd.Series:
    """Best-match member for ``var``; falls back to the member mean when it is missing."""
    c = col(var, PRIMARY_MEMBER)
    mat = member_matrix(nwp, var)
    if mat.empty:
        return pd.Series(np.nan, index=nwp.index)
    if c in nwp.columns and nwp[c].notna().any():
        return nwp[c].fillna(mat.mean(axis=1))
    return mat.mean(axis=1)


def build_features(nwp: pd.DataFrame, weights: dict[str, float], lat: float) -> pd.DataFrame:
    idx = nwp.index
    hour = idx.hour.to_numpy() + idx.minute.to_numpy() / 60.0
    doy = idx.dayofyear.to_numpy().astype(float)

    temps = member_matrix(nwp, "temperature_2m")
    blend = blend_temperature(nwp, weights)
    precip = member_matrix(nwp, "precipitation")

    feats = pd.DataFrame(index=idx)
    feats["hour_sin"] = np.sin(2 * np.pi * hour / 24.0)
    feats["hour_cos"] = np.cos(2 * np.pi * hour / 24.0)
    feats["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    feats["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
    feats["nwp_temp_blend"] = blend
    feats["nwp_temp_primary"] = primary_series(nwp, "temperature_2m")
    feats["nwp_humidity"] = primary_series(nwp, "relative_humidity_2m")
    feats["nwp_wind"] = primary_series(nwp, "wind_speed_10m")
    feats["nwp_pressure"] = primary_series(nwp, "surface_pressure")
    feats["nwp_cloud"] = primary_series(nwp, "cloud_cover")
    feats["nwp_precip"] = precip.mean(axis=1) if not precip.empty else 0.0
    feats["lead_hours"] = nwp["lead_hours"] if "lead_hours" in nwp.columns else 0.0
    feats["ens_mean"] = temps.mean(axis=1)
    feats["ens_spread"] = temps.std(axis=1, ddof=0) if temps.shape[1] > 1 else 0.0
    feats["ens_members"] = float(temps.shape[1])
    # lags assume an hourly, contiguous index (true for Open-Meteo and the synthetic source)
    for lag in (1, 3, 6):
        feats[f"nwp_temp_lag{lag}"] = blend.shift(lag).bfill()
    feats["lat"] = float(lat)

    feats = feats[list(FEATURE_NAMES)]
    # column-wise fill, then neutral defaults (pressure/humidity sensible means) for empty columns
    feats = feats.ffill().bfill()
    defaults = {"nwp_humidity": 60.0, "nwp_pressure": 1013.0, "nwp_cloud": 50.0, "nwp_wind": 3.0}
    for c, v in defaults.items():
        feats[c] = feats[c].fillna(v)
    return feats.fillna(0.0).astype(float)


def member_names(nwp: pd.DataFrame) -> list[str]:
    return [m for m in MEMBERS if col("temperature_2m", m) in nwp.columns]
