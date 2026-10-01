"""Training of the per-location post-processing model.

Components
  (a) residual regressor (obs − blended NWP temperature): HistGradientBoosting vs Ridge, the one
      with lower validation MAE is kept;
  (b) P10 / P90 quantile regressors on the same residual (HistGradientBoosting, loss="quantile");
  (c) precipitation-occurrence classifier (HistGradientBoostingClassifier) + isotonic calibration
      fitted on a held-out slice of the training period;
  (d) ensemble blend: member weights ∝ 1 / validation-period MAE of each member.

Time-ordered split: first 80 % train, last 20 % validation. Metrics are reported on validation.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from ..data.base import PRIMARY_MEMBER, HistoricalData, available_members, col
from ..features import FEATURE_LABELS, FEATURE_NAMES, build_features, member_matrix
from .base import (
    Z80,
    finalize_prediction,
    heuristic_precip_probability,
    lead_inflation,
    nwp_precip_probability,
)
from .climatology import ClimatologyModel

log = logging.getLogger(__name__)

MIN_SAMPLES = 500
WET_THRESHOLD_MM = 0.1
DEGENERATE_RESIDUAL_STD = 0.05  # °C; below this obs ≡ forecast and training is meaningless


@dataclass
class TrainedModel:
    key: str
    lat: float
    lon: float
    trained_at: datetime
    training_samples: int
    algorithm: str
    regressor_kind: str
    weights: dict[str, float]
    residual_model: Any
    q10_model: Any
    q90_model: Any
    precip_clf: Any | None
    calibrator: Any | None
    metrics: dict[str, float]
    diagnostics: dict[str, Any]
    data_source: str
    mock: bool
    feature_names: list[str] = field(default_factory=lambda: [FEATURE_LABELS[f] for f in FEATURE_NAMES])

    def predict(self, nwp: pd.DataFrame) -> pd.DataFrame:
        feats = build_features(nwp, self.weights, self.lat)
        x = feats.to_numpy()
        blend = feats["nwp_temp_blend"].to_numpy()
        temp = blend + self.residual_model.predict(x)
        q10 = blend + self.q10_model.predict(x)
        q90 = blend + self.q90_model.predict(x)

        lead = feats["lead_hours"].to_numpy()
        infl = lead_inflation(lead)
        spread = feats["ens_spread"].to_numpy()
        lo = np.sqrt((np.clip(temp - q10, 0.3, None) * infl) ** 2 + 0.5 * (Z80 * spread) ** 2)
        hi = np.sqrt((np.clip(q90 - temp, 0.3, None) * infl) ** 2 + 0.5 * (Z80 * spread) ** 2)

        if self.precip_clf is not None:
            raw = self.precip_clf.predict_proba(x)[:, 1]
            prob = self.calibrator.predict(raw) if self.calibrator is not None else raw
        else:
            prob = heuristic_precip_probability(feats["nwp_precip"]).to_numpy()
        nwp_pp = nwp_precip_probability(nwp)
        if nwp_pp is not None:
            prob = 0.7 * prob + 0.3 * nwp_pp.to_numpy()
        return finalize_prediction(nwp, temp, temp - lo, temp + hi, prob)


def _hgb_regressor(**kw) -> HistGradientBoostingRegressor:
    params = dict(
        max_iter=150,
        learning_rate=0.08,
        max_leaf_nodes=15,
        min_samples_leaf=20,
        l2_regularization=1.0,
        random_state=0,
    )
    params.update(kw)
    return HistGradientBoostingRegressor(**params)


def _mae(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))


def _brier(p: np.ndarray, y: np.ndarray) -> float:
    return float(np.mean((np.asarray(p) - np.asarray(y, dtype=float)) ** 2))


def train_location_model(
    hist: HistoricalData,
    lat: float,
    lon: float,
    key: str,
    now_utc: datetime,
    max_samples: int = 8760,
) -> TrainedModel | ClimatologyModel:
    t0 = time.perf_counter()
    try:
        return _train(hist, lat, lon, key, now_utc, max_samples, t0)
    except Exception as exc:  # training must never take the API down
        log.exception("training failed for %s; using climatology fallback", key)
        return ClimatologyModel.from_observations(
            key,
            lat,
            lon,
            hist.obs,
            now_utc,
            reason=f"training error: {exc}",
            data_source=hist.source,
            mock=hist.mock,
        )


def _train(
    hist: HistoricalData, lat: float, lon: float, key: str, now_utc: datetime, max_samples: int, t0: float
) -> TrainedModel | ClimatologyModel:
    obs, nwp = hist.obs, hist.nwp
    temp_members = available_members(nwp, "temperature_2m")
    if not temp_members or "temperature_2m" not in obs.columns:
        return ClimatologyModel.from_observations(
            key,
            lat,
            lon,
            obs,
            now_utc,
            reason="no NWP temperature members",
            data_source=hist.source,
            mock=hist.mock,
        )
    common = obs.index.intersection(nwp.index)
    obs, nwp = obs.loc[common], nwp.loc[common]
    valid = obs["temperature_2m"].notna() & member_matrix(nwp, "temperature_2m").notna().any(axis=1)
    obs, nwp = obs.loc[valid], nwp.loc[valid]
    if len(obs) > max_samples:
        obs, nwp = obs.iloc[-max_samples:], nwp.iloc[-max_samples:]
    n = len(obs)
    if n < MIN_SAMPLES:
        return ClimatologyModel.from_observations(
            key,
            lat,
            lon,
            obs,
            now_utc,
            reason=f"only {n} samples (< {MIN_SAMPLES})",
            data_source=hist.source,
            mock=hist.mock,
        )

    y_temp = obs["temperature_2m"].to_numpy()
    primary_col = col("temperature_2m", PRIMARY_MEMBER)
    temps_all = member_matrix(nwp, "temperature_2m", temp_members)
    primary_probe = nwp[primary_col] if primary_col in nwp.columns else temps_all.mean(axis=1)
    if float(np.nanstd(primary_probe.to_numpy() - y_temp)) < DEGENERATE_RESIDUAL_STD:
        # observations are (almost) the forecast itself: the archive served the forecast model
        return ClimatologyModel.from_observations(
            key,
            lat,
            lon,
            obs,
            now_utc,
            reason="observations identical to the NWP series; no residual to learn",
            data_source=hist.source,
            mock=hist.mock,
        )

    split = int(n * 0.8)
    tr = slice(0, split)
    va = slice(split, n)

    # (d) member weights from training-period MAE
    temps = member_matrix(nwp, "temperature_2m", temp_members)
    member_mae_train = {m: _mae(temps[m].to_numpy()[tr], y_temp[tr]) for m in temps.columns}
    inv = {m: 1.0 / max(v, 0.05) for m, v in member_mae_train.items()}
    total = sum(inv.values())
    weights = {m: round(v / total, 4) for m, v in inv.items()}

    feats = build_features(nwp, weights, lat)
    x = feats.to_numpy()
    blend = feats["nwp_temp_blend"].to_numpy()
    y_resid = y_temp - blend

    # (a) residual regressor: HGB vs Ridge
    hgb = _hgb_regressor().fit(x[tr], y_resid[tr])
    ridge = make_pipeline(StandardScaler(), Ridge(alpha=1.0)).fit(x[tr], y_resid[tr])
    mae_hgb = _mae(blend[va] + hgb.predict(x[va]), y_temp[va])
    mae_ridge = _mae(blend[va] + ridge.predict(x[va]), y_temp[va])
    if mae_hgb <= mae_ridge:
        residual_model, regressor_kind, mae_corr = hgb, "gradient-boosting", mae_hgb
    else:
        residual_model, regressor_kind, mae_corr = ridge, "ridge", mae_ridge

    # (b) quantiles
    q10 = _hgb_regressor(loss="quantile", quantile=0.1, max_iter=100).fit(x[tr], y_resid[tr])
    q90 = _hgb_regressor(loss="quantile", quantile=0.9, max_iter=100).fit(x[tr], y_resid[tr])
    p10_va = blend[va] + q10.predict(x[va])
    p90_va = blend[va] + q90.predict(x[va])
    coverage = float(np.mean((y_temp[va] >= p10_va) & (y_temp[va] <= p90_va)))

    # (c) precipitation occurrence + isotonic calibration
    precip_clf = calibrator = None
    brier = brier_nwp = None
    if "precipitation" in obs.columns:
        y_wet = (obs["precipitation"].fillna(0).to_numpy() >= WET_THRESHOLD_MM).astype(int)
        cal_split = int(split * 0.75)
        fit_idx, cal_idx = slice(0, cal_split), slice(cal_split, split)
        if y_wet[fit_idx].min() != y_wet[fit_idx].max() and y_wet[fit_idx].sum() >= 20:
            precip_clf = HistGradientBoostingClassifier(
                max_iter=120,
                learning_rate=0.08,
                max_leaf_nodes=15,
                min_samples_leaf=20,
                l2_regularization=1.0,
                random_state=0,
            ).fit(x[fit_idx], y_wet[fit_idx])
            raw_cal = precip_clf.predict_proba(x[cal_idx])[:, 1]
            if y_wet[cal_idx].min() != y_wet[cal_idx].max():
                calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(
                    raw_cal, y_wet[cal_idx]
                )
            raw_va = precip_clf.predict_proba(x[va])[:, 1]
            p_va = calibrator.predict(raw_va) if calibrator is not None else raw_va
            brier = _brier(p_va, y_wet[va])
            brier_nwp = _brier(heuristic_precip_probability(feats["nwp_precip"]).to_numpy()[va], y_wet[va])

    primary_col = col("temperature_2m", PRIMARY_MEMBER)
    raw_primary = (
        nwp[primary_col].fillna(temps.mean(axis=1)).to_numpy()
        if primary_col in nwp.columns
        else temps.mean(axis=1).to_numpy()
    )
    mae_nwp = _mae(raw_primary[va], y_temp[va])
    mae_blend = _mae(blend[va], y_temp[va])
    member_mae_val = {m: round(_mae(temps[m].to_numpy()[va], y_temp[va]), 3) for m in temps.columns}

    metrics = {
        "temperature_mae": round(mae_corr, 3),
        "temperature_mae_nwp": round(mae_nwp, 3),
    }
    if brier is not None:
        metrics["precipitation_brier"] = round(brier, 4)

    elapsed = time.perf_counter() - t0
    diagnostics = {
        "regressor": regressor_kind,
        "mae_hgb": round(mae_hgb, 3),
        "mae_ridge": round(mae_ridge, 3),
        "mae_blend_uncorrected": round(mae_blend, 3),
        "member_mae_validation": member_mae_val,
        "weights": weights,
        "p10_p90_coverage": round(coverage, 3),
        "precipitation_brier_nwp_heuristic": None if brier_nwp is None else round(brier_nwp, 4),
        "train_samples": split,
        "validation_samples": n - split,
        "train_period": [str(obs.index[0]), str(obs.index[split - 1])],
        "validation_period": [str(obs.index[split]), str(obs.index[-1])],
        "training_seconds": round(elapsed, 2),
        "data_source": hist.source,
    }
    algorithm = "ensemble-blend" if len(temp_members) > 1 else regressor_kind
    log.info(
        "trained %s: n=%d regressor=%s mae=%.3f nwp=%.3f brier=%s in %.1fs",
        key,
        n,
        regressor_kind,
        mae_corr,
        mae_nwp,
        brier,
        elapsed,
    )
    return TrainedModel(
        key=key,
        lat=lat,
        lon=lon,
        trained_at=now_utc,
        training_samples=n,
        algorithm=algorithm,
        regressor_kind=regressor_kind,
        weights=weights,
        residual_model=residual_model,
        q10_model=q10,
        q90_model=q90,
        precip_clf=precip_clf,
        calibrator=calibrator,
        metrics=metrics,
        diagnostics=diagnostics,
        data_source=hist.source,
        mock=hist.mock,
    )
