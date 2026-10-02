"""Inference wrapper for the forecast artifacts (offline-trained only).

Same code path as training (`ml.features.build_feature_row`), so train/serve
skew cannot appear. Trailing aggregates and the day-of-month profile are
computed at the forecast origin and held constant over the horizon; only
calendar features vary (ml/features.py docstring). Returns typed results —
no thresholds or business rules here (code-standards §3 ml specifics).
"""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from ml.features import (FEATURE_COLUMNS, build_feature_row, cashout_trailing,
                         daily_flows, dom_net_profile, obligation_days,
                         user_aggregates)

ARTIFACTS = Path(__file__).parent / "artifacts" / "forecast"
_DAYS_PER_MONTH = 30.4375  # calendar constant: mean Gregorian month length


@dataclass(frozen=True)
class DailyForecast:
    date: dt.date
    p10_paisa: int
    p50_paisa: int
    p90_paisa: int


@dataclass(frozen=True)
class ForecastResult:
    model_version: str
    origin: dt.date
    days: tuple[DailyForecast, ...]          # net-flow quantiles per day
    residuals_paisa: tuple[int, ...]         # trailing residuals (for paths)
    spread_scale: float                      # predicted vs historical spread
    confidence: str                          # "normal" | "low"
    n_history_days: int


def load_latest_version(artifacts_dir: Path = ARTIFACTS) -> str:
    return json.loads((artifacts_dir / "latest.json").read_text())["version"]


def load_metadata(artifacts_dir: Path = ARTIFACTS) -> dict:
    version = load_latest_version(artifacts_dir)
    return json.loads((artifacts_dir / version / "metadata.json").read_text())


def persona_prior_aggregates(persona_cfg: dict, prior_std_ratio: float) -> dict:
    """Persona priors derived from config values only (low-data fallback).

    Expected per-day inflow = income streams normalized to per-day; outflow =
    daily spend + obligations + expected cash-outs, all from config.
    """
    mean_in = 0.0
    for stream in persona_cfg.get("income_streams", []):
        if "day_of_month" in stream:
            mean_in += float(stream["amount_paisa"]) / _DAYS_PER_MONTH
        elif "every_days" in stream:
            mean_in += float(stream["amount_paisa"]) / float(stream["every_days"])
        elif "daily_mean_paisa" in stream:
            mean_in += float(stream["daily_mean_paisa"])
    mean_out = 0.0
    spend = persona_cfg.get("daily_spend")
    if spend:
        mean_out += float(spend["mean_paisa"])
    for ob in persona_cfg.get("obligations", []):
        if "day" in ob:
            mean_out += float(ob["amount_paisa"]) / _DAYS_PER_MONTH
        elif "every_days" in ob:
            mean_out += float(ob["amount_paisa"]) / float(ob["every_days"])
    co = persona_cfg.get("cashout")
    if co:
        per_month = sum(co["per_month"]) / 2.0
        amount = sum(co["amount_paisa"]) / 2.0
        mean_out += per_month * amount / _DAYS_PER_MONTH
    gross = mean_in + mean_out
    return {
        "mean_in": mean_in,
        "mean_out": mean_out,
        "std_net": gross * prior_std_ratio,
        "mean_net": mean_in - mean_out,
        "n_days": 0,
    }


class Forecaster:
    """Loads versioned quantile models once; predicts daily net quantiles."""

    def __init__(self, artifacts_dir: Path = ARTIFACTS):
        self._dir = artifacts_dir
        self.version = load_latest_version(artifacts_dir)
        self.metadata = json.loads((artifacts_dir / self.version / "metadata.json").read_text())
        self._models = {
            q: lgb.Booster(model_file=str(artifacts_dir / self.version / f"model_q{int(q * 100)}.txt"))
            for q in (0.1, 0.5, 0.9)
        }

    def predict(self, txns: pd.DataFrame, persona: str, persona_cfg: dict,
                origin: dt.date, horizon_days: int, cfg,
                min_history_days: int, min_history_transactions: int) -> ForecastResult:
        """Quantile net flows for origin+1 .. origin+horizon_days.

        txns: this user's transactions with columns ts/type/amount_paisa and
        boolean is_inflow. origin: the as_of date (never wall-clock).
        """
        ds = cfg.section("dataset")
        sim_cfg = cfg.section("app")["simulation"]
        window_start = dt.date.fromisoformat(ds["start_date"])
        festival = set(cfg.section("calendar")["festival_days"])

        n_txns = int(len(txns))
        daily = daily_flows(txns, window_start, origin)
        n_hist_days = int((daily["inflow_paisa"] + daily["outflow_paisa"] > 0).sum())
        low_data = n_hist_days < min_history_days or n_txns < min_history_transactions

        if low_data:
            agg = persona_prior_aggregates(persona_cfg, float(sim_cfg["prior_std_ratio"]))
            hist = daily
        else:
            agg = user_aggregates(daily, origin)
            hist = daily[daily["date"] < origin].tail(90)
        profile = dom_net_profile(daily, origin)
        income_dom = None
        for stream in persona_cfg["income_streams"]:
            if "day_of_month" in stream:
                income_dom = int(stream["day_of_month"])
        tx_dated = txns.assign(
            date=pd.to_datetime(txns["ts"], utc=True).dt.tz_convert("Asia/Dhaka").dt.date)
        obligations = obligation_days(tx_dated)
        co = cashout_trailing(txns, window_start, origin)
        co_row = co.iloc[-1] if not co.empty else None
        agg = dict(agg)
        agg.update({
            "cashout_count_30d": float(co_row["cashout_count_30d"]) if co_row is not None else 0.0,
            "cashout_mean_30d": float(co_row["cashout_mean_30d"]) if co_row is not None else 0.0,
            "days_since_cashout": float(co_row["days_since_cashout"]) if co_row is not None else 30.0,
        })

        rows = []
        for i in range(1, horizon_days + 1):
            d = origin + dt.timedelta(days=i)
            rows.append(build_feature_row(d, agg, income_dom, obligations, festival,
                                          persona, dom_profile=profile))
        X = pd.DataFrame(rows)[FEATURE_COLUMNS].to_numpy(dtype=float)
        mean_net = X[:, FEATURE_COLUMNS.index("mean_net")]
        preds = {q: mean_net + self._models[q].predict(X) for q in (0.1, 0.5, 0.9)}
        # Quantile crossing guard: order is enforced, never assumed.
        p10 = np.minimum.reduce([preds[0.1], preds[0.5], preds[0.9]])
        p90 = np.maximum.reduce([preds[0.1], preds[0.5], preds[0.9]])
        p50 = np.clip(preds[0.5], p10, p90)

        if low_data or hist.empty:
            # No usable history: a deterministic symmetric residual pool with
            # the prior spread keeps the simulation honest (no fake zeros).
            residuals = np.linspace(-1.5, 1.5, 30) * max(agg["std_net"], 1.0)
        else:
            net = (hist["inflow_paisa"] - hist["outflow_paisa"]).to_numpy(dtype=float)
            residuals = net - agg["mean_net"]
        hist_spread = float(np.subtract(*np.percentile(residuals, [90, 10]))) if len(residuals) else 0.0
        pred_spread = float(np.median(p90 - p10))
        if hist_spread > 0:
            scale = float(np.clip(pred_spread / hist_spread,
                                  float(sim_cfg["spread_scale_min"]),
                                  float(sim_cfg["spread_scale_max"])))
        else:
            scale = 1.0

        days = tuple(
            DailyForecast(
                date=origin + dt.timedelta(days=i + 1),
                p10_paisa=int(round(p10[i])),
                p50_paisa=int(round(p50[i])),
                p90_paisa=int(round(p90[i])),
            )
            for i in range(horizon_days)
        )
        return ForecastResult(
            model_version=self.version,
            origin=origin,
            days=days,
            residuals_paisa=tuple(int(r) for r in residuals),
            spread_scale=scale,
            confidence="low" if low_data else "normal",
            n_history_days=n_hist_days,
        )
