from __future__ import annotations

import numpy as np
import pandas as pd

from skycast_ai.hazards import HAZARDS, HazardInput, apparent_temperature, evaluate_hazards

N = 72


def _scenario(temp: float, *, precip=0.0, prob=0.0, wind=3.0, rh=60.0, sigma=1.0) -> HazardInput:
    idx = pd.date_range("2026-01-15 00:00", periods=N, freq="h", name="time")
    t = np.full(N, float(temp))
    z = 1.2815515655446004
    return HazardInput(
        time=idx,
        temperature=t,
        temperature_p10=t - z * sigma,
        temperature_p90=t + z * sigma,
        precipitation=np.full(N, float(precip)),
        precipitation_probability=np.full(N, float(prob)),
        wind_speed=np.full(N, float(wind)),
        humidity=np.full(N, float(rh)),
        member_temps=np.stack([t, t + 0.5, t - 0.5], axis=1),
    )


def _all_probs(result):
    return [p for day in result.daily.values() for p in day.values()] + [
        v for hz in result.horizon.values() for v in hz.values()
    ]


def test_probabilities_in_unit_interval():
    res = evaluate_hazards(_scenario(5.0, precip=0.5, prob=0.4, wind=10.0, rh=40.0), n_samples=100)
    assert all(0.0 <= p <= 1.0 for p in _all_probs(res))
    assert set(next(iter(res.daily.values()))) == set(HAZARDS)
    assert all(0.0 <= r.probability <= 1.0 for r in res.risks)


def test_cold_wave_high_for_minus_20():
    res = evaluate_hazards(_scenario(-20.0), n_samples=200)
    assert res.horizon["cold-wave"]["advisory"] > 0.95
    assert res.horizon["cold-wave"]["warning"] > 0.95
    risks = [r for r in res.risks if r.hazard == "cold-wave"]
    assert {r.severity for r in risks} == {"advisory", "warning"}
    assert risks[0].expected_start == "2026-01-15T00:00"
    assert "3/3 models" in risks[0].rationale and "Ensemble spread" in risks[0].rationale


def test_cold_wave_zero_for_plus_20():
    res = evaluate_hazards(_scenario(20.0), n_samples=200)
    assert res.horizon["cold-wave"]["advisory"] < 0.01
    assert all(day["cold-wave"] < 0.01 for day in res.daily.values())
    assert not any(r.hazard == "cold-wave" for r in res.risks)


def test_cold_wave_marginal_is_uncertain():
    # mean 2.5 °C above the threshold with σ = 1.5: a crossing somewhere in 72 h is plausible, not certain
    res = evaluate_hazards(_scenario(-9.5, sigma=1.5), n_samples=400)
    p = res.horizon["cold-wave"]["advisory"]
    assert 0.05 < p < 0.95, p
    assert res.horizon["cold-wave"]["warning"] < p


def test_heavy_rain_and_strong_wind():
    rain = evaluate_hazards(_scenario(15.0, precip=40.0, prob=1.0), n_samples=100)
    assert rain.horizon["heavy-rain"]["advisory"] > 0.9
    assert rain.horizon["heavy-snow"]["advisory"] == 0.0  # too warm for snow
    wind = evaluate_hazards(_scenario(10.0, wind=18.0), n_samples=100)
    assert wind.horizon["strong-wind"]["advisory"] > 0.9
    calm = evaluate_hazards(_scenario(10.0, wind=2.0), n_samples=100)
    assert calm.horizon["strong-wind"]["advisory"] == 0.0


def test_heavy_snow_dry_and_heat():
    snow = evaluate_hazards(_scenario(-5.0, precip=1.0, prob=1.0), n_samples=100)
    assert snow.horizon["heavy-snow"]["advisory"] > 0.9
    dry = evaluate_hazards(_scenario(10.0, rh=15.0), n_samples=100)
    assert dry.horizon["dry"]["warning"] > 0.9
    heat = evaluate_hazards(_scenario(37.0, rh=50.0, wind=1.0), n_samples=100)
    assert heat.horizon["heat-wave"]["advisory"] > 0.9
    assert apparent_temperature(np.array([37.0]), np.array([50.0]), np.array([1.0]))[0] > 37.0


def test_risks_sorted_and_deterministic():
    inp = _scenario(-14.0, wind=16.0, rh=20.0, sigma=2.0)
    a = evaluate_hazards(inp, n_samples=150, seed=7)
    b = evaluate_hazards(inp, n_samples=150, seed=7)
    assert [r.model_dump() for r in a.risks] == [r.model_dump() for r in b.risks]
    probs = [r.probability for r in a.risks]
    assert probs == sorted(probs, reverse=True)
    assert all(r.probability >= 0.2 for r in a.risks)
