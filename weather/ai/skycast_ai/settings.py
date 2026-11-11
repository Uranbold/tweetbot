"""Runtime settings (environment variables / .env)."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

AI_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = Field(default=8790, description="HTTP port for uvicorn")
    host: str = "0.0.0.0"
    data_mode: Literal["auto", "live", "synthetic"] = Field(
        default="auto",
        description="auto = live Open-Meteo with synthetic fallback; live = no fallback; "
        "synthetic = never call upstream",
    )
    cache_dir: Path = AI_ROOT / ".cache"
    model_dir: Path = AI_ROOT / ".models"
    upstream_timeout_s: float = 6.0
    log_level: str = "INFO"
    history_days: int = Field(default=365, ge=30, le=730)
    history_cache_ttl_s: int = 24 * 3600
    forecast_cache_ttl_s: int = 3600
    model_ttl_s: int = Field(default=24 * 3600, description="Retrain a cached model after this")
    max_training_samples: int = 8760
    hazard_samples: int = Field(default=200, ge=20, le=2000)
    cors_origins: str = "*"


def get_settings(**overrides) -> Settings:
    return Settings(**overrides)
