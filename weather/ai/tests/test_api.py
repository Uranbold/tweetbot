from __future__ import annotations

import re
import time

from skycast_ai.data.base import UpstreamError
from skycast_ai.hazards import HAZARDS
from tests.conftest import SEOUL, UB

CAMEL = re.compile(r"^[a-z][a-zA-Z0-9]*$")


def _assert_camel(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if path.endswith("hazardProbabilities"):
                assert k in HAZARDS, (path, k)
            else:
                assert CAMEL.match(k), f"non-camelCase key {k!r} at {path}"
            _assert_camel(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _assert_camel(v, f"{path}[{i}]")


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["dataMode"] == "synthetic"
    assert "uptimeSeconds" in body


def test_predict_shape_matches_contract(client):
    r = client.get("/predict", params={"lat": UB[0], "lon": UB[1], "hours": 72})
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"data", "meta"}
    _assert_camel(body)
    meta = body["meta"]
    assert meta == {"provider": "skycast-ai", "fetchedAt": meta["fetchedAt"], "stale": False, "mock": True}
    assert meta["fetchedAt"].endswith("Z")

    data = body["data"]
    assert set(data) == {
        "location",
        "generatedAt",
        "horizonHours",
        "hourly",
        "daily",
        "risks",
        "summary",
        "model",
    }
    assert data["horizonHours"] == 72 and len(data["hourly"]) == 72
    loc = data["location"]
    assert loc["id"] == "47.92,106.92" and loc["name"] == "Ulaanbaatar" and loc["countryCode"] == "MN"
    assert loc["timezone"] == "Asia/Ulaanbaatar" and loc["utcOffsetSeconds"] == 28800

    h0 = data["hourly"][0]
    assert set(h0) == {
        "time",
        "temperature",
        "temperatureNwp",
        "temperatureP10",
        "temperatureP90",
        "precipitationProbability",
        "precipitation",
    }
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:00$", h0["time"])
    for h in data["hourly"]:
        assert h["temperatureP10"] <= h["temperature"] <= h["temperatureP90"]
        assert 0 <= h["precipitationProbability"] <= 100
        assert h["precipitation"] >= 0

    d0 = data["daily"][0]
    assert set(d0) == {
        "date",
        "temperatureMin",
        "temperatureMax",
        "temperatureMinP10",
        "temperatureMaxP90",
        "precipitationSum",
        "hazardProbabilities",
    }
    assert set(d0["hazardProbabilities"]) == set(HAZARDS)
    assert all(0 <= p <= 1 for p in d0["hazardProbabilities"].values())
    for d in data["daily"]:
        assert d["temperatureMinP10"] <= d["temperatureMin"] <= d["temperatureMax"] <= d["temperatureMaxP90"]

    for risk in data["risks"]:
        assert set(risk) <= {"hazard", "severity", "probability", "expectedStart", "rationale"}
        assert risk["probability"] >= 0.2 and risk["severity"] in ("advisory", "warning")
    probs = [r["probability"] for r in data["risks"]]
    assert probs == sorted(probs, reverse=True)

    model = data["model"]
    assert model["name"] == "skycast-gbr-v1" and model["trainingSamples"] > 0
    assert set(model["metrics"]) == {"temperatureMae", "temperatureMaeNwp", "precipitationBrier"}
    assert model["metrics"]["temperatureMae"] < model["metrics"]["temperatureMaeNwp"]
    assert len(model["features"]) >= 10
    assert "raw model" in data["summary"] and data["summary"].endswith(".")


def test_predict_default_hours_and_max(client):
    assert (
        client.get("/predict", params={"lat": SEOUL[0], "lon": SEOUL[1]}).json()["data"]["horizonHours"] == 72
    )
    r = client.get("/predict", params={"lat": SEOUL[0], "lon": SEOUL[1], "hours": 168})
    assert r.status_code == 200
    assert len(r.json()["data"]["hourly"]) == 168
    assert 7 <= len(r.json()["data"]["daily"]) <= 8


def test_predict_is_deterministic_and_warm_fast(client):
    params = {"lat": UB[0], "lon": UB[1], "hours": 48}
    a = client.get("/predict", params=params).json()
    t0 = time.perf_counter()
    b = client.get("/predict", params=params).json()
    assert time.perf_counter() - t0 < 1.0
    assert a["data"] == b["data"]


def test_unknown_location_label(client):
    r = client.get("/predict", params={"lat": 45.0, "lon": 100.0, "hours": 24})
    assert r.status_code == 200
    loc = r.json()["data"]["location"]
    assert loc["name"] == "45.00°N 100.00°E" and loc["country"] == "" and loc["id"] == "45.00,100.00"


def test_validation_errors(client):
    for params in (
        {"lat": 95, "lon": 0},
        {"lat": 0, "lon": -181},
        {"lat": 0, "lon": 0, "hours": 12},
        {"lat": 0, "lon": 0, "hours": 169},
        {"lat": "abc", "lon": 0},
        {"lon": 0},
    ):
        r = client.get("/predict", params=params)
        assert r.status_code == 400, params
        body = r.json()
        assert set(body) == {"error"} and body["error"]["code"] == "BAD_REQUEST"
        assert body["error"]["message"]


def test_model_info_and_train(client):
    r = client.get("/model-info", params={"lat": UB[0], "lon": UB[1]})
    assert r.status_code == 200
    body = r.json()
    assert body["data"]["algorithm"] in ("ensemble-blend", "gradient-boosting", "ridge")
    assert body["meta"]["mock"] is True
    assert "weights" in body["diagnostics"]
    before = body["data"]["trainedAt"]
    r2 = client.post("/train", params={"lat": UB[0], "lon": UB[1]})
    assert r2.status_code == 200
    assert r2.json()["data"]["trainingSamples"] == 8760
    assert r2.json()["data"]["trainedAt"] >= before


def test_openapi_lists_endpoints(client):
    spec = client.get("/openapi.json").json()
    assert {"/predict", "/health", "/model-info", "/train"} <= set(spec["paths"])
    props = spec["components"]["schemas"]["PredictedHourly"]["properties"]
    assert "temperatureNwp" in props and "temperature_nwp" not in props


def test_live_mode_upstream_error_maps_to_503(settings, predictor):
    from fastapi.testclient import TestClient

    from skycast_ai.app import create_app

    class Failing:
        name = "failing"

        def fetch_history(self, *a, **k):
            raise UpstreamError("Daily API request limit exceeded", status=429)

        def fetch_forecast(self, *a, **k):
            raise UpstreamError("Daily API request limit exceeded", status=429)

    from skycast_ai.predictor import Predictor

    live = Predictor(
        settings.model_copy(update={"data_mode": "live"}), source=Failing(), store=predictor.store
    )
    c = TestClient(create_app(settings, predictor=live))
    r = c.get("/predict", params={"lat": 10, "lon": 10})
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "RATE_LIMITED"


def test_fallback_source_marks_mock(settings, synthetic):
    from skycast_ai.data.fallback import FallbackDataSource
    from tests.conftest import FIXED_NOW

    class Failing:
        name = "failing"

        def fetch_history(self, *a, **k):
            raise UpstreamError("HTTP 503", status=503)

        def fetch_forecast(self, *a, **k):
            raise UpstreamError("timeout")

    src = FallbackDataSource(Failing(), synthetic)
    fc = src.fetch_forecast(*UB, FIXED_NOW, 24)
    assert fc.mock is True and src.fallbacks == 1


def test_synthetic_model_is_not_applied_to_live_forecast(settings, synthetic):
    """History 429 but live forecast OK → NWP must be passed through, not 'corrected' with fake biases."""
    from tests.conftest import FIXED_NOW

    class HalfLive:
        name = "half-live"

        def fetch_history(self, *a, **k):
            raise UpstreamError("Daily API request limit exceeded", status=429)

        def fetch_forecast(self, lat, lon, now_utc, hours):
            fc = synthetic.fetch_forecast(lat, lon, now_utc, hours)
            fc.mock = False  # pretend this came from Open-Meteo
            fc.source = "open-meteo"
            return fc

    from skycast_ai.data.fallback import FallbackDataSource
    from skycast_ai.models import ModelStore
    from skycast_ai.predictor import Predictor

    store = ModelStore(settings.model_dir / "halflive", ttl_s=3600, clock=lambda: FIXED_NOW)
    p = Predictor(
        settings, source=FallbackDataSource(HalfLive(), synthetic), store=store, clock=lambda: FIXED_NOW
    )
    body = p.predict(*UB, 48).model_dump(by_alias=True)
    assert body["meta"]["mock"] is True
    assert body["data"]["model"]["algorithm"] == "climatology-fallback"
    assert body["data"]["model"]["trainingSamples"] == 0
    assert all(h["temperature"] == h["temperatureNwp"] for h in body["data"]["hourly"])
    assert all(h["temperatureP10"] < h["temperature"] < h["temperatureP90"] for h in body["data"]["hourly"])
    assert "not trained on real observations" in body["data"]["summary"]
