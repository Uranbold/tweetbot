from __future__ import annotations

from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient

from skycast_ai.app import create_app
from skycast_ai.data.synthetic import SyntheticDataSource
from skycast_ai.models.trainer import train_location_model
from skycast_ai.predictor import Predictor
from skycast_ai.settings import Settings

UB = (47.92, 106.92)
SEOUL = (37.57, 126.98)
FIXED_NOW = datetime(2026, 10, 1, 6, 0, 0)  # UTC
HISTORY_END = date(2026, 9, 24)


@pytest.fixture(scope="session")
def synthetic() -> SyntheticDataSource:
    return SyntheticDataSource()


@pytest.fixture(scope="session")
def ub_history(synthetic):
    return synthetic.fetch_history(*UB, HISTORY_END, 365)


@pytest.fixture(scope="session")
def ub_forecast(synthetic):
    return synthetic.fetch_forecast(*UB, FIXED_NOW, 168)


@pytest.fixture(scope="session")
def ub_model(ub_history):
    return train_location_model(ub_history, *UB, key="test_ub", now_utc=FIXED_NOW)


@pytest.fixture(scope="session")
def settings(tmp_path_factory) -> Settings:
    root = tmp_path_factory.mktemp("skycast")
    return Settings(
        data_mode="synthetic",
        cache_dir=root / "cache",
        model_dir=root / "models",
        log_level="WARNING",
        hazard_samples=100,
    )


@pytest.fixture(scope="session")
def predictor(settings) -> Predictor:
    return Predictor(settings, clock=lambda: FIXED_NOW)


@pytest.fixture(scope="session")
def client(settings, predictor) -> TestClient:
    app = create_app(settings, predictor=predictor)
    return TestClient(app)
