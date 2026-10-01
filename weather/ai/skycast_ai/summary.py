"""Template-based, deterministic plain-English summary of a prediction."""

from __future__ import annotations

import pandas as pd

from .schemas import HazardRisk, ModelInfo, PredictedDaily, PredictedHourly


def _period_label(now_local: pd.Timestamp) -> str:
    h = now_local.hour
    if h < 5:
        return "overnight"
    if h < 12:
        return "this morning"
    if h < 17:
        return "this afternoon"
    if h < 21:
        return "this evening"
    return "tonight"


def _part_of_day(ts: pd.Timestamp, now_local: pd.Timestamp) -> str:
    h = ts.hour
    if h < 6:
        part = "night"
    elif h < 12:
        part = "morning"
    elif h < 18:
        part = "afternoon"
    else:
        part = "evening"
    delta_days = (ts.normalize() - now_local.normalize()).days
    if delta_days == 0:
        return "tonight" if part == "night" else f"this {part}"
    if delta_days == 1:
        return f"tomorrow {part}"
    return f"{ts.strftime('%A')} {part}"


def build_summary(
    now_local: pd.Timestamp,
    hourly: list[PredictedHourly],
    daily: list[PredictedDaily],
    risks: list[HazardRisk],
    model: ModelInfo,
) -> str:
    sentences: list[str] = []

    # 1. correction vs raw NWP over the next 12 hours
    head = hourly[:12] if len(hourly) >= 12 else hourly
    if head:
        delta = sum(h.temperature - h.temperature_nwp for h in head) / len(head)
        label = _period_label(now_local)
        if abs(delta) < 0.3:
            sentences.append(
                f"AI-adjusted forecast agrees with the raw model {label} (within 0.3°)."
            )
        else:
            word = "warmer" if delta > 0 else "colder"
            sentences.append(
                f"AI-adjusted forecast runs {abs(delta):.1f}° {word} than the raw model {label}."
            )

    # 2. headline hazard
    if risks:
        top = risks[0]
        when = ""
        if top.expected_start:
            when = " " + _part_of_day(pd.Timestamp(top.expected_start), now_local)
        sentences.append(
            f"{int(round(top.probability * 100))}% chance of a "
            f"{top.hazard.replace('-', ' ')} {top.severity}{when}."
        )
    else:
        sentences.append("No hazard thresholds are likely to be crossed within the horizon.")

    # 3. precipitation outlook
    wet_days = [
        (d, max((h.precipitation_probability for h in hourly if h.time.startswith(d.date)), default=0))
        for d in daily
    ]
    wet_days = [(d, p) for d, p in wet_days if p >= 50 and d.precipitation_sum >= 1.0]
    if wet_days:
        d, p = wet_days[0]
        day_name = pd.Timestamp(d.date).strftime("%A")
        if pd.Timestamp(d.date).normalize() == now_local.normalize():
            day_name = "today"
        kind = "Snow" if d.temperature_max <= 1.0 else "Precipitation"
        sentences.append(f"{kind} likely {day_name} ({int(round(p))}%, about {d.precipitation_sum:.0f} mm).")

    # 4. model provenance
    m = model.metrics
    if model.training_samples > 0 and m.temperature_mae is not None and m.temperature_mae_nwp is not None:
        gain = m.temperature_mae_nwp - m.temperature_mae
        sentences.append(
            f"Model trained on {model.training_samples:,} hours; validation MAE "
            f"{m.temperature_mae:.2f} °C vs {m.temperature_mae_nwp:.2f} °C raw NWP "
            f"({'−' if gain >= 0 else '+'}{abs(gain):.2f} °C)."
        )
    else:
        sentences.append("Climatology fallback in use: no trained model for this location yet.")
    return " ".join(sentences)
