"""Climatology fallback: used when training is impossible (too little data or an error).

It passes the NWP temperature through unchanged and attaches a ±spread band derived from the
observed month/hour climatology when available (else a flat 3 °C), so the API still returns a
complete, honest ``AiPrediction`` with ``trainingSamples = 0``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

import numpy as np
import pandas as pd

from ..features import member_matrix, primary_series
from .base import (
    Z80,
    finalize_prediction,
    heuristic_precip_probability,
    lead_inflation,
    nwp_precip_probability,
)

ALGORITHM = "climatology-fallback"


@dataclass
class ClimatologyModel:
    key: str
    lat: float
    lon: float
    trained_at: datetime
    reason: str
    data_source: str = "none"
    mock: bool = False
    sigma_by_month: dict[int, float] = field(default_factory=dict)
    default_sigma: float = 3.0

    algorithm: str = ALGORITHM
    training_samples: int = 0
    weights: dict[str, float] = field(default_factory=dict)
    feature_names: list[str] = field(
        default_factory=lambda: ["NWP temperature (pass-through)", "monthly climatological spread"]
    )

    @property
    def metrics(self) -> dict:
        return {}

    @property
    def diagnostics(self) -> dict:
        return {"reason": self.reason, "sigma_by_month": self.sigma_by_month}

    @classmethod
    def from_observations(
        cls,
        key: str,
        lat: float,
        lon: float,
        obs: pd.DataFrame | None,
        trained_at: datetime,
        reason: str,
        **kw,
    ) -> ClimatologyModel:
        sigma: dict[int, float] = {}
        if obs is not None and "temperature_2m" in obs.columns and len(obs) > 48:
            t = obs["temperature_2m"].dropna()
            anomalies = t - t.groupby([t.index.month, t.index.hour]).transform("mean")
            for month, grp in anomalies.groupby(anomalies.index.month):
                sigma[int(month)] = float(np.clip(grp.std(), 1.0, 8.0))
        return cls(
            key=key, lat=lat, lon=lon, trained_at=trained_at, reason=reason, sigma_by_month=sigma, **kw
        )

    def predict(self, nwp: pd.DataFrame) -> pd.DataFrame:
        temp = primary_series(nwp, "temperature_2m").to_numpy()  # pass-through: delta vs NWP is 0
        months = nwp.index.month.to_numpy()
        sigma = np.array([self.sigma_by_month.get(int(m), self.default_sigma) for m in months])
        lead = nwp["lead_hours"].to_numpy() if "lead_hours" in nwp.columns else np.zeros(len(nwp))
        half = Z80 * sigma * lead_inflation(lead)
        pp = nwp_precip_probability(nwp)
        if pp is None:
            precip = member_matrix(nwp, "precipitation")
            pp = heuristic_precip_probability(
                precip.mean(axis=1) if not precip.empty else pd.Series(0.0, index=nwp.index)
            )
        return finalize_prediction(nwp, temp, temp - half, temp + half, pp.to_numpy())
