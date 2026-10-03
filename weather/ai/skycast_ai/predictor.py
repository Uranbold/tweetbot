"""Orchestration: fetch data → (lazily) train/load the location model → predict → hazards →
summary → contract-shaped response."""

from __future__ import annotations

import hashlib
import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import numpy as np
import pandas as pd

from . import MODEL_NAME, __version__
from .data import DataSource, build_data_source
from .data.base import HistoricalData, LiveForecast
from .features import member_matrix
from .hazards import HazardInput, evaluate_hazards
from .locations import build_location
from .models import ClimatologyModel, ModelStore, TrainedModel, model_key, train_location_model
from .schemas import (
    AiPrediction,
    ApiMeta,
    HazardRisk,
    ModelInfo,
    ModelInfoResponse,
    ModelMetrics,
    PredictedDaily,
    PredictedHourly,
    PredictResponse,
)
from .settings import Settings
from .summary import build_summary

log = logging.getLogger(__name__)

ARCHIVE_LAG_DAYS = 6  # the reanalysis archive trails real time by ~5 days


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _iso_utc(dt: datetime) -> str:
    return dt.replace(tzinfo=None).strftime("%Y-%m-%dT%H:%M:%SZ")


def _iso_local(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M")


class Predictor:
    def __init__(
        self,
        settings: Settings,
        source: DataSource | None = None,
        store: ModelStore | None = None,
        clock: Callable[[], datetime] | None = None,
    ):
        self.settings = settings
        self.source = source or build_data_source(settings)
        self.clock = clock or _utcnow
        self.store = store or ModelStore(settings.model_dir, ttl_s=settings.model_ttl_s, clock=self.clock)
        self.started_at = time.time()

    # ----------------------------------------------------------------- models
    def _history(self, lat: float, lon: float, now_utc: datetime) -> HistoricalData:
        end = (now_utc - timedelta(days=ARCHIVE_LAG_DAYS)).date()
        return self.source.fetch_history(lat, lon, end, self.settings.history_days)

    def get_model(self, lat: float, lon: float, force: bool = False) -> TrainedModel | ClimatologyModel:
        key = model_key(lat, lon)
        if not force:
            cached = self.store.get(key)
            if cached is not None:
                return cached
        with self.store.lock_for(key):
            if not force:
                cached = self.store.get(key)
                if cached is not None:
                    return cached
            now_utc = self.clock()
            t0 = time.perf_counter()
            try:
                hist = self._history(lat, lon, now_utc)
            except Exception as exc:
                log.warning("history unavailable for %s (%s); climatology fallback", key, exc)
                stale = self.store.get(key, allow_stale=True)
                if stale is not None:
                    return stale
                model = ClimatologyModel.from_observations(
                    key, lat, lon, None, now_utc, reason=f"history unavailable: {exc}"
                )
                self.store.put(key, model)
                return model
            model = train_location_model(
                hist, lat, lon, key, now_utc, max_samples=self.settings.max_training_samples
            )
            self.store.put(key, model)
            log.info(
                "model ready key=%s algorithm=%s samples=%d took=%.2fs",
                key,
                model.algorithm,
                model.training_samples,
                time.perf_counter() - t0,
            )
            return model

    def model_info(self, lat: float, lon: float, force: bool = False) -> ModelInfoResponse:
        model = self.get_model(lat, lon, force=force)
        return ModelInfoResponse(
            data=self._model_info(model),
            meta=ApiMeta(fetched_at=_iso_utc(self.clock()), mock=bool(model.mock)),
            diagnostics=dict(model.diagnostics),
        )

    def _model_info(self, model: TrainedModel | ClimatologyModel) -> ModelInfo:
        metrics = model.metrics or {}
        return ModelInfo(
            name=MODEL_NAME,
            version=__version__,
            algorithm=model.algorithm,
            trained_at=_iso_utc(model.trained_at),
            training_samples=int(model.training_samples),
            metrics=ModelMetrics(
                temperature_mae=metrics.get("temperature_mae"),
                temperature_mae_nwp=metrics.get("temperature_mae_nwp"),
                precipitation_brier=metrics.get("precipitation_brier"),
            ),
            features=list(model.feature_names),
        )

    # --------------------------------------------------------------- predict
    def predict(self, lat: float, lon: float, hours: int) -> PredictResponse:
        now_utc = self.clock()
        fc: LiveForecast = self.source.fetch_forecast(lat, lon, now_utc, hours)
        model = self.get_model(lat, lon)
        if getattr(model, "mock", False) and not fc.mock:
            # A correction learned from synthetic history must never be applied to a real forecast:
            # pass the NWP through with a climatological band until live history is available.
            log.warning("model %s is synthetic-trained but forecast is live; passing NWP through", model.key)
            model = ClimatologyModel.from_observations(
                model.key,
                lat,
                lon,
                None,
                model.trained_at,
                reason="location model trained on synthetic data; NWP passed through uncorrected",
                data_source="none",
                mock=True,
            )

        now_local = pd.Timestamp(now_utc + timedelta(seconds=fc.utc_offset_seconds)).floor("h")
        pred_full = model.predict(fc.nwp)
        window = pred_full.loc[
            (pred_full.index >= now_local) & (pred_full.index < now_local + pd.Timedelta(hours=hours))
        ]
        if window.empty:  # clock skew vs upstream: take whatever is in the future
            window = pred_full.iloc[-hours:]
        nwp_window = fc.nwp.loc[window.index]

        hourly = [
            PredictedHourly(
                time=_iso_local(ts),
                temperature=round(float(r.temperature), 1),
                temperature_nwp=round(float(r.temperature_nwp), 1),
                temperature_p10=round(float(r.temperature_p10), 1),
                temperature_p90=round(float(r.temperature_p90), 1),
                precipitation_probability=int(round(float(r.precipitation_probability) * 100)),
                precipitation=round(float(r.precipitation), 2),
            )
            for ts, r in window.iterrows()
        ]

        hazard_input = HazardInput(
            time=window.index,
            temperature=window["temperature"].to_numpy(),
            temperature_p10=window["temperature_p10"].to_numpy(),
            temperature_p90=window["temperature_p90"].to_numpy(),
            precipitation=window["precipitation"].to_numpy(),
            precipitation_probability=window["precipitation_probability"].to_numpy(),
            wind_speed=window["wind_speed"].to_numpy(),
            humidity=window["humidity"].to_numpy(),
            member_temps=_matrix_or_none(nwp_window, "temperature_2m"),
            member_wind=_matrix_or_none(nwp_window, "wind_speed_10m"),
            member_precip=_matrix_or_none(nwp_window, "precipitation"),
        )
        hazards = evaluate_hazards(
            hazard_input,
            n_samples=self.settings.hazard_samples,
            seed=_seed_for(lat, lon, now_local),
        )

        daily = self._daily(window, hazards.daily)
        risks: list[HazardRisk] = hazards.risks
        model_info = self._model_info(model)
        summary = build_summary(now_local, hourly, daily, risks, model_info)

        location = build_location(lat, lon, fc.timezone, fc.utc_offset_seconds, fc.elevation)
        data = AiPrediction(
            location=location,
            generated_at=_iso_utc(now_utc),
            horizon_hours=len(hourly),
            hourly=hourly,
            daily=daily,
            risks=risks,
            summary=summary,
            model=model_info,
        )
        meta = ApiMeta(
            provider="skycast-ai",
            fetched_at=_iso_utc(fc.fetched_at),
            stale=False,
            mock=bool(fc.mock or model.mock),
        )
        return PredictResponse(data=data, meta=meta)

    @staticmethod
    def _daily(window: pd.DataFrame, hazard_daily: dict[str, dict[str, float]]) -> list[PredictedDaily]:
        out: list[PredictedDaily] = []
        for day, grp in window.groupby(window.index.strftime("%Y-%m-%d")):
            probs = hazard_daily.get(day, {})
            out.append(
                PredictedDaily(
                    date=str(day),
                    temperature_min=round(float(grp["temperature"].min()), 1),
                    temperature_max=round(float(grp["temperature"].max()), 1),
                    temperature_min_p10=round(float(grp["temperature_p10"].min()), 1),
                    temperature_max_p90=round(float(grp["temperature_p90"].max()), 1),
                    precipitation_sum=round(float(grp["precipitation"].sum()), 1),
                    hazard_probabilities={k: float(v) for k, v in probs.items()},
                )
            )
        return out

    def stats(self) -> dict:
        return {
            "uptime_seconds": round(time.time() - self.started_at, 1),
            "models_loaded": len(self.store),
            "data_mode": self.settings.data_mode,
        }


def _matrix_or_none(nwp: pd.DataFrame, var: str) -> np.ndarray | None:
    mat = member_matrix(nwp, var)
    if mat.empty:
        return None
    return mat.to_numpy(dtype=float)


def _seed_for(lat: float, lon: float, now_local: pd.Timestamp) -> int:
    raw = f"{round(lat, 2)}|{round(lon, 2)}|{now_local.strftime('%Y%m%d%H')}".encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:4], "little")
