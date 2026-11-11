"""Common prediction output contract for all model kinds."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..data.base import PRIMARY_MEMBER, col
from ..features import member_matrix, primary_series

Z80 = 1.2815515655446004

PREDICTION_COLUMNS = (
    "temperature",
    "temperature_nwp",
    "temperature_p10",
    "temperature_p90",
    "precipitation_probability",  # 0..1
    "precipitation",  # mm
    "wind_speed",
    "humidity",
    "ens_spread",
)


def nwp_precip_probability(nwp: pd.DataFrame) -> pd.Series | None:
    """Mean of the members' precipitation_probability (0..1) when the live frame has it."""
    mat = member_matrix(nwp, "precipitation_probability")
    if mat.empty or mat.isna().all().all():
        return None
    return (mat.mean(axis=1) / 100.0).clip(0, 1)


def heuristic_precip_probability(precip_mm: pd.Series) -> pd.Series:
    return (1.0 - np.exp(-precip_mm.clip(lower=0) / 0.8)).clip(0, 1)


def finalize_prediction(
    nwp: pd.DataFrame,
    temperature: np.ndarray,
    p10: np.ndarray,
    p90: np.ndarray,
    precip_prob: np.ndarray,
) -> pd.DataFrame:
    """Assemble the standard prediction frame and enforce P10 ≤ T ≤ P90 and physical bounds."""
    idx = nwp.index
    temperature = np.asarray(temperature, dtype=float)
    p10 = np.minimum(np.asarray(p10, dtype=float), temperature - 0.1)
    p90 = np.maximum(np.asarray(p90, dtype=float), temperature + 0.1)
    precip_mm = member_matrix(nwp, "precipitation")
    precip_mean = precip_mm.mean(axis=1).fillna(0.0) if not precip_mm.empty else pd.Series(0.0, index=idx)
    prob = np.clip(np.asarray(precip_prob, dtype=float), 0.0, 1.0)
    # suppress NWP "drizzle": tiny amounts with low calibrated probability
    precip_out = np.where((prob < 0.15) & (precip_mean.to_numpy() < 0.3), 0.0, precip_mean.to_numpy())
    temps = member_matrix(nwp, "temperature_2m")
    spread = temps.std(axis=1, ddof=0) if temps.shape[1] > 1 else pd.Series(0.0, index=idx)
    primary_temp_col = col("temperature_2m", PRIMARY_MEMBER)
    temp_nwp = (
        nwp[primary_temp_col].fillna(temps.mean(axis=1))
        if primary_temp_col in nwp.columns
        else temps.mean(axis=1)
    )
    return pd.DataFrame(
        {
            "temperature": temperature,
            "temperature_nwp": temp_nwp.to_numpy(),
            "temperature_p10": p10,
            "temperature_p90": p90,
            "precipitation_probability": prob,
            "precipitation": np.clip(precip_out, 0, None),
            "wind_speed": primary_series(nwp, "wind_speed_10m").fillna(3.0).clip(lower=0).to_numpy(),
            "humidity": primary_series(nwp, "relative_humidity_2m").fillna(60.0).clip(0, 100).to_numpy(),
            "ens_spread": spread.fillna(0.0).to_numpy(),
        },
        index=idx,
    )


def lead_inflation(lead_hours: np.ndarray) -> np.ndarray:
    """Uncertainty grows with lead time: ×1 at analysis time, ≈×1.4 at 72 h, ≈×1.8 at 168 h."""
    return np.sqrt(1.0 + np.clip(np.asarray(lead_hours, dtype=float), 0, None) / 72.0)
