"""Hazard probabilities by Monte Carlo sampling from the predicted distribution.

Thresholds follow the KMA special-report (특보) definitions quoted in the contract / BA.md.
``fine-dust`` (needs air-quality data) and ``typhoon`` (needs cyclone tracks) are not evaluated.

The sampler draws ``n_samples`` scenario trajectories per variable with AR(1)-correlated noise so
that multi-hour accumulations (3 h / 12 h rain, 24 h snow, 2-day persistence) behave realistically.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .schemas import HazardRisk

HAZARDS: tuple[str, ...] = ("heat-wave", "cold-wave", "heavy-rain", "heavy-snow", "strong-wind", "dry")

# (advisory, warning)
THRESHOLDS = {
    "heat-wave": {"feels_like_max": (33.0, 35.0), "days": 2},
    "cold-wave": {"temp_min": (-12.0, -15.0)},
    "heavy-rain": {"rain_3h": (60.0, 90.0), "rain_12h": (110.0, 180.0)},
    "heavy-snow": {"snow_24h": (5.0, 20.0)},
    "strong-wind": {"wind": (14.0, 21.0), "gust": (20.0, 26.0)},
    "dry": {"humidity": (35.0, 25.0), "days": 2},
}

Z80 = 1.2815515655446004  # Φ⁻¹(0.9): P90 − P10 = 2·Z80·σ


@dataclass
class HazardInput:
    """Hourly predicted distribution (contiguous hourly local times)."""

    time: pd.DatetimeIndex
    temperature: np.ndarray
    temperature_p10: np.ndarray
    temperature_p90: np.ndarray
    precipitation: np.ndarray  # mm/h expected
    precipitation_probability: np.ndarray  # 0..1
    wind_speed: np.ndarray  # m/s
    humidity: np.ndarray  # %
    wind_gust: np.ndarray | None = None  # m/s (estimated when None)
    member_temps: np.ndarray | None = None  # (hours, members) raw NWP members for the rationale
    member_wind: np.ndarray | None = None
    member_precip: np.ndarray | None = None
    member_names: list[str] = field(default_factory=list)


@dataclass
class HazardResult:
    daily: dict[str, dict[str, float]]  # date -> hazard -> P(advisory or worse)
    risks: list[HazardRisk]
    horizon: dict[str, dict[str, float]]  # hazard -> {"advisory": p, "warning": p}


def apparent_temperature(t: np.ndarray, rh: np.ndarray, wind: np.ndarray) -> np.ndarray:
    """Steadman apparent temperature (used by the Australian BoM); °C, %, m/s."""
    e = rh / 100.0 * 6.105 * np.exp(17.27 * t / (237.7 + t))
    return t + 0.33 * e - 0.70 * wind - 4.0


def _ar_noise(rng: np.random.Generator, n_samples: int, n_hours: int, phi: float) -> np.ndarray:
    """Standard-normal AR(1) noise, shape (samples, hours)."""
    out = np.empty((n_samples, n_hours))
    out[:, 0] = rng.standard_normal(n_samples)
    scale = np.sqrt(1 - phi * phi)
    for i in range(1, n_hours):
        out[:, i] = phi * out[:, i - 1] + scale * rng.standard_normal(n_samples)
    return out


def _rolling_sum(x: np.ndarray, window: int) -> np.ndarray:
    """Trailing rolling sum along axis 1 (shorter windows at the start)."""
    c = np.cumsum(x, axis=1)
    out = c.copy()
    out[:, window:] = c[:, window:] - c[:, :-window]
    return out


def _normal_cdf(x: np.ndarray) -> np.ndarray:
    # Abramowitz-Stegun erf approximation (avoids scipy)
    z = x / np.sqrt(2.0)
    sign = np.sign(z)
    az = np.abs(z)
    t = 1.0 / (1.0 + 0.3275911 * az)
    poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
    erf = sign * (1.0 - poly * np.exp(-az * az))
    return 0.5 * (1.0 + erf)


def sample_scenarios(inp: HazardInput, n_samples: int, seed: int) -> dict[str, np.ndarray]:
    rng = np.random.default_rng(seed)
    n = len(inp.time)
    sigma = np.clip((inp.temperature_p90 - inp.temperature_p10) / (2 * Z80), 0.3, None)

    temp = inp.temperature[None, :] + sigma[None, :] * _ar_noise(rng, n_samples, n, 0.9)

    # precipitation: correlated occurrence via Gaussian copula + lognormal amount
    p = np.clip(inp.precipitation_probability, 0.0, 1.0)
    u = _normal_cdf(_ar_noise(rng, n_samples, n, 0.8))
    occurs = u < p[None, :]
    cond_mean = np.where(p > 0.05, inp.precipitation / np.clip(p, 0.05, 1), inp.precipitation)
    amount = cond_mean[None, :] * np.exp(rng.normal(-0.125, 0.5, size=(n_samples, n)))
    precip = np.where(occurs, amount, 0.0)

    wind_mult = np.exp(0.25 * _ar_noise(rng, n_samples, n, 0.85) - 0.03)
    wind = inp.wind_speed[None, :] * wind_mult
    gust_base = inp.wind_gust if inp.wind_gust is not None else inp.wind_speed * 1.5
    gust = gust_base[None, :] * wind_mult

    rh = np.clip(inp.humidity[None, :] + 8.0 * _ar_noise(rng, n_samples, n, 0.9), 0, 100)

    snow_ratio = np.clip((1.0 - temp) / 1.5, 0, 1)  # all snow at ≤ -0.5 °C, none above 1 °C
    snow_cm = precip * snow_ratio  # ~10:1 ratio → 1 mm water ≈ 1 cm snow

    return {"temp": temp, "precip": precip, "wind": wind, "gust": gust, "rh": rh, "snow": snow_cm}


def _daily_groups(time: pd.DatetimeIndex) -> tuple[list[str], np.ndarray]:
    dates = time.strftime("%Y-%m-%d")
    uniq = list(dict.fromkeys(dates))
    codes = np.array([uniq.index(d) for d in dates])
    return uniq, codes


def _reduce_daily(x: np.ndarray, codes: np.ndarray, n_days: int, how: str) -> np.ndarray:
    out = np.empty((x.shape[0], n_days))
    for d in range(n_days):
        block = x[:, codes == d]
        if how == "max":
            out[:, d] = block.max(axis=1)
        elif how == "min":
            out[:, d] = block.min(axis=1)
        else:
            out[:, d] = block.mean(axis=1)
    return out


def _two_day_persist(flag: np.ndarray) -> np.ndarray:
    """Day d counts when it and an adjacent day both satisfy the condition."""
    prev = np.zeros_like(flag)
    nxt = np.zeros_like(flag)
    prev[:, 1:] = flag[:, :-1]
    nxt[:, :-1] = flag[:, 1:]
    return flag & (prev | nxt)


def _hourly_flags(s: dict[str, np.ndarray], level: int) -> dict[str, np.ndarray]:
    """Per-hour crossing flags (samples × hours) at threshold level 0=advisory, 1=warning."""
    th = THRESHOLDS
    return {
        "cold-wave": s["temp"] <= th["cold-wave"]["temp_min"][level],
        "heavy-rain": (_rolling_sum(s["precip"], 3) >= th["heavy-rain"]["rain_3h"][level])
        | (_rolling_sum(s["precip"], 12) >= th["heavy-rain"]["rain_12h"][level]),
        "heavy-snow": _rolling_sum(s["snow"], 24) >= th["heavy-snow"]["snow_24h"][level],
        "strong-wind": (s["wind"] >= th["strong-wind"]["wind"][level])
        | (s["gust"] >= th["strong-wind"]["gust"][level]),
        "heat-wave": s["feels"] >= th["heat-wave"]["feels_like_max"][level],
        "dry": s["rh"] <= th["dry"]["humidity"][level],
    }


def _daily_flags(
    hourly: dict[str, np.ndarray], s: dict[str, np.ndarray], codes: np.ndarray, n_days: int, level: int
) -> dict[str, np.ndarray]:
    out: dict[str, np.ndarray] = {}
    for hz in ("cold-wave", "heavy-rain", "heavy-snow", "strong-wind"):
        out[hz] = _reduce_daily(hourly[hz].astype(float), codes, n_days, "max") > 0
    feels_max = _reduce_daily(s["feels"], codes, n_days, "max")
    out["heat-wave"] = _two_day_persist(feels_max >= THRESHOLDS["heat-wave"]["feels_like_max"][level])
    rh_mean = _reduce_daily(s["rh"], codes, n_days, "mean")
    out["dry"] = _two_day_persist(rh_mean <= THRESHOLDS["dry"]["humidity"][level])
    return out


def _spread_word(spread: float) -> str:
    if spread < 1.0:
        return "narrow"
    if spread < 2.5:
        return "moderate"
    return "wide"


def _agreement(inp: HazardInput, hazard: str, level: int) -> str | None:
    th = THRESHOLDS
    if hazard == "cold-wave" and inp.member_temps is not None:
        n = int((inp.member_temps.min(axis=0) <= th["cold-wave"]["temp_min"][level]).sum())
        return f"{n}/{inp.member_temps.shape[1]} models reach {th['cold-wave']['temp_min'][level]:.0f} °C"
    if hazard == "heat-wave" and inp.member_temps is not None:
        n = int((inp.member_temps.max(axis=0) >= th["heat-wave"]["feels_like_max"][level] - 2).sum())
        return f"{n}/{inp.member_temps.shape[1]} models within 2 °C of the threshold"
    if hazard == "strong-wind" and inp.member_wind is not None:
        n = int((inp.member_wind.max(axis=0) >= th["strong-wind"]["wind"][level]).sum())
        return f"{n}/{inp.member_wind.shape[1]} models reach {th['strong-wind']['wind'][level]:.0f} m/s"
    if hazard == "heavy-rain" and inp.member_precip is not None:
        c = np.cumsum(inp.member_precip, axis=0)
        r3 = c.copy()
        r3[3:] = c[3:] - c[:-3]
        n = int((r3.max(axis=0) >= th["heavy-rain"]["rain_3h"][level]).sum())
        return (
            f"{n}/{inp.member_precip.shape[1]} models exceed {th['heavy-rain']['rain_3h'][level]:.0f} mm/3 h"
        )
    return None


def _fmt_time(ts: pd.Timestamp) -> str:
    return ts.strftime("%A %H:00")


def evaluate_hazards(inp: HazardInput, n_samples: int = 200, seed: int = 20260101) -> HazardResult:
    time = inp.time
    n_hours = len(time)
    if n_hours == 0:
        return HazardResult(daily={}, risks=[], horizon={})

    s = sample_scenarios(inp, n_samples, seed)
    s["feels"] = np.where(s["temp"] >= 24.0, apparent_temperature(s["temp"], s["rh"], s["wind"]), s["temp"])
    dates, codes = _daily_groups(time)
    n_days = len(dates)

    hourly = {lvl: _hourly_flags(s, lvl) for lvl in (0, 1)}
    daily = {lvl: _daily_flags(hourly[lvl], s, codes, n_days, lvl) for lvl in (0, 1)}

    daily_probs: dict[str, dict[str, float]] = {d: {} for d in dates}
    for hz in HAZARDS:
        p_day = daily[0][hz].mean(axis=0)
        for d_i, d in enumerate(dates):
            daily_probs[d][hz] = float(round(p_day[d_i], 3))

    spread = float(np.mean(inp.temperature_p90 - inp.temperature_p10)) / (2 * Z80)
    risks: list[HazardRisk] = []
    horizon: dict[str, dict[str, float]] = {}
    for hz in HAZARDS:
        p_adv = float(daily[0][hz].any(axis=1).mean())
        p_warn = float(daily[1][hz].any(axis=1).mean())
        horizon[hz] = {"advisory": round(p_adv, 3), "warning": round(p_warn, 3)}
        for level, severity, prob in ((0, "advisory", p_adv), (1, "warning", p_warn)):
            if prob < 0.2:
                continue
            start = _expected_start(hourly[level][hz], daily[level][hz], codes, time)
            when = f" around {_fmt_time(start)}" if start is not None else ""
            agreement = _agreement(inp, hz, level)
            parts = [
                f"Ensemble spread {_spread_word(spread)} (σ≈{spread:.1f} °C)",
                f"{int(round(prob * 100))}% of {n_samples} scenarios cross the "
                f"{hz.replace('-', ' ')} {severity} threshold{when}",
            ]
            if agreement:
                parts.insert(1, agreement)
            risks.append(
                HazardRisk(
                    hazard=hz,
                    severity=severity,
                    probability=round(prob, 3),
                    expected_start=start.strftime("%Y-%m-%dT%H:%M") if start is not None else None,
                    rationale="; ".join(parts) + ".",
                )
            )
    risks.sort(key=lambda r: (-r.probability, r.hazard, r.severity))
    return HazardResult(daily=daily_probs, risks=risks, horizon=horizon)


def _expected_start(
    hourly_flag: np.ndarray, daily_flag: np.ndarray, codes: np.ndarray, time: pd.DatetimeIndex
) -> pd.Timestamp | None:
    """First hour where P(crossing) ≥ 0.5, restricted to days whose daily probability is ≥ 0.5."""
    p_hour = hourly_flag.mean(axis=0)
    p_day = daily_flag.mean(axis=0)
    ok_day = p_day[codes] >= 0.5
    hits = np.where((p_hour >= 0.5) & ok_day)[0]
    if len(hits) == 0:
        # persistence hazards: fall back to first qualifying day
        days = np.where(p_day >= 0.5)[0]
        if len(days) == 0:
            return None
        first = np.where(codes == days[0])[0][0]
        return time[first]
    return time[hits[0]]
