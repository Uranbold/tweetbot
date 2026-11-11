from __future__ import annotations

import pandas as pd

from skycast_ai.locations import build_location, coordinate_label, nearest_city
from skycast_ai.schemas import HazardRisk, ModelInfo, ModelMetrics, PredictedDaily, PredictedHourly
from skycast_ai.summary import build_summary


def _model(samples=8760):
    return ModelInfo(
        name="skycast-gbr-v1",
        version="1.0.0",
        algorithm="ensemble-blend",
        trained_at="2026-10-01T00:00:00Z",
        training_samples=samples,
        metrics=ModelMetrics(temperature_mae=0.8, temperature_mae_nwp=1.1, precipitation_brier=0.06),
        features=["x"],
    )


def _hourly(delta: float, n=24):
    out = []
    for i in range(n):
        ts = pd.Timestamp("2026-01-14 21:00") + pd.Timedelta(hours=i)
        out.append(
            PredictedHourly(
                time=ts.strftime("%Y-%m-%dT%H:%M"),
                temperature=-10 + delta,
                temperature_nwp=-10,
                temperature_p10=-12,
                temperature_p90=-8,
                precipitation_probability=5,
                precipitation=0,
            )
        )
    return out


def test_summary_mentions_delta_and_top_risk():
    now = pd.Timestamp("2026-01-14 21:00")
    risk = HazardRisk(
        hazard="cold-wave",
        severity="advisory",
        probability=0.68,
        expected_start="2026-01-15T06:00",
        rationale="r",
    )
    daily = [
        PredictedDaily(
            date="2026-01-15",
            temperature_min=-15,
            temperature_max=-5,
            temperature_min_p10=-17,
            temperature_max_p90=-3,
            precipitation_sum=0,
            hazard_probabilities={"cold-wave": 0.68},
        )
    ]
    s = build_summary(now, _hourly(-1.4), daily, [risk], _model())
    assert s.startswith("AI-adjusted forecast runs 1.4° colder than the raw model tonight.")
    assert "68% chance of a cold wave advisory tomorrow morning." in s
    assert "8,760 hours" in s
    assert build_summary(now, _hourly(-1.4), daily, [risk], _model()) == s  # deterministic


def test_summary_no_risk_and_fallback():
    now = pd.Timestamp("2026-01-14 09:00")
    s = build_summary(now, _hourly(0.1), [], [], _model(samples=0))
    assert "agrees with the raw model this morning" in s
    assert "No hazard thresholds" in s
    assert "No bias correction applied" in s


def test_locations():
    assert nearest_city(47.95, 106.90).name == "Ulaanbaatar"
    assert nearest_city(45.0, 100.0) is None
    assert coordinate_label(-33.87, -70.65) == "33.87°S 70.65°W"
    loc = build_location(37.5665, 126.978, "Asia/Seoul", 32400, 38.0)
    assert loc.id == "37.57,126.98" and loc.name == "Seoul" and loc.elevation == 38.0
    assert loc.model_dump(by_alias=True)["utcOffsetSeconds"] == 32400
    anon = build_location(45.0, 100.0, None, None)
    assert anon.name == "45.00°N 100.00°E" and anon.timezone  # tz guessed, never empty
