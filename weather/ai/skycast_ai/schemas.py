"""Pydantic models mirroring the `/predict` section of weather/shared/contract.ts.

All models serialise with camelCase keys (alias_generator) and accept snake_case on input.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

HazardKey = Literal[
    "heat-wave",
    "cold-wave",
    "heavy-rain",
    "heavy-snow",
    "strong-wind",
    "dry",
    "fine-dust",
    "typhoon",
]
AlertSeverity = Literal["advisory", "warning"]
ErrorCode = Literal["BAD_REQUEST", "NOT_FOUND", "UPSTREAM_UNAVAILABLE", "RATE_LIMITED", "INTERNAL"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")


class Location(CamelModel):
    id: str
    name: str
    admin1: str | None = None
    country: str
    country_code: str
    lat: float
    lon: float
    timezone: str
    utc_offset_seconds: int
    elevation: float | None = None


class PredictedHourly(CamelModel):
    time: str
    temperature: float
    temperature_nwp: float
    temperature_p10: float
    temperature_p90: float
    precipitation_probability: float = Field(ge=0, le=100)
    precipitation: float = Field(ge=0)


class PredictedDaily(CamelModel):
    date: str
    temperature_min: float
    temperature_max: float
    temperature_min_p10: float
    temperature_max_p90: float
    precipitation_sum: float
    hazard_probabilities: dict[HazardKey, float]


class HazardRisk(CamelModel):
    hazard: HazardKey
    severity: AlertSeverity
    probability: float = Field(ge=0, le=1)
    expected_start: str | None = None
    rationale: str


class ModelMetrics(CamelModel):
    temperature_mae: float | None = None
    temperature_mae_nwp: float | None = None
    precipitation_brier: float | None = None


class ModelInfo(CamelModel):
    name: str
    version: str
    algorithm: str
    trained_at: str
    training_samples: int
    metrics: ModelMetrics
    features: list[str]


class AiPrediction(CamelModel):
    location: Location
    generated_at: str
    horizon_hours: int
    hourly: list[PredictedHourly]
    daily: list[PredictedDaily]
    risks: list[HazardRisk]
    summary: str
    model: ModelInfo


class ApiMeta(CamelModel):
    provider: str = "skycast-ai"
    fetched_at: str
    stale: bool = False
    mock: bool = False


class PredictResponse(CamelModel):
    data: AiPrediction
    meta: ApiMeta


class ModelInfoResponse(CamelModel):
    data: ModelInfo
    meta: ApiMeta
    diagnostics: dict = Field(default_factory=dict)


class ErrorBody(BaseModel):
    code: ErrorCode
    message: str


class ApiError(BaseModel):
    error: ErrorBody


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "skycast-ai"
    version: str
    uptime_seconds: float = Field(serialization_alias="uptimeSeconds")
    data_mode: str = Field(serialization_alias="dataMode")
    models_loaded: int = Field(serialization_alias="modelsLoaded")
