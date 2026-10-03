"""Forecast service: LightGBM quantile forecaster + recurring streams + path simulation.

ml.inference does the modelling (same code path as the evaluation); this
service loads the user's history, formats paired display strings and builds
the evidence block. The forecaster is loaded once per model version.
"""
from __future__ import annotations

import datetime as dt
import sqlite3
from functools import lru_cache

import numpy as np
import pandas as pd

from api.errors import NotFoundError
from api.repositories import users as users_repo
from api.schemas.common import Evidence
from api.schemas.extended import DailyForecastPoint, ForecastData
from api.services.evidence import as_of_date, build_evidence
from core.formatting import format_date, format_probability, format_taka
from ml.inference import Forecaster, UserForecast, load_latest_version, stable_seed
from ml.panel import festival_window


@lru_cache(maxsize=2)
def _forecaster(version: str) -> Forecaster:
    return Forecaster(version=version)


def _user_tx(conn: sqlite3.Connection, user_id: str) -> pd.DataFrame:
    return pd.read_sql_query(
        "SELECT ts, type, amount_paisa, fee_paisa, counterparty_id, balance_after_paisa "
        "FROM transactions WHERE user_id = ? ORDER BY ts", conn, params=(user_id,))


def user_forecast(conn: sqlite3.Connection, cfg, user_id: str) -> UserForecast | None:
    """Model forecast at as_of (None when the user has no transactions)."""
    tx = _user_tx(conn, user_id)
    if tx.empty:
        return None
    th = cfg.section("thresholds")
    sim = cfg.section("simulation")
    origin = as_of_date(cfg)
    return _forecaster(load_latest_version()).forecast_transactions(
        user_id, tx, origin, int(th["shortfall_horizon_days"]),
        festival=festival_window(cfg), floor_days=int(th["shortfall_floor_days"]),
        n_paths=int(sim["n_paths"]), seed=stable_seed(sim["seed"], user_id),
        min_history_days=int(th["min_history_days"]))


def get_forecast(conn: sqlite3.Connection, cfg, user_id: str) -> tuple[ForecastData, Evidence]:
    user = users_repo.get_user(conn, user_id)
    if user is None:
        raise NotFoundError()

    origin = as_of_date(cfg)
    horizon = int(cfg.section("thresholds")["shortfall_horizon_days"])
    f = user_forecast(conn, cfg, user_id)
    if f is None:
        paths = np.zeros((1, horizon + 1), dtype=np.int64)
        prob, trough, confidence, n_tx = 0.0, None, "low", 0
    else:
        paths, prob, trough, confidence = f.paths, f.p_shortfall, f.trough_day, f.confidence
        n_tx = len(_user_tx(conn, user_id))
    start_balance = int(paths[0, 0])

    trough_date_str = None
    if trough is not None and trough > 0:
        trough_date_str = format_date(origin + dt.timedelta(days=int(trough)), "bn")

    risk_cfg = cfg.section("risk")
    if prob >= float(risk_cfg.get("high_cutoff", 0.60)):
        risk_level = "high"
    elif prob >= float(risk_cfg.get("low_cutoff", 0.25)):
        risk_level = "medium"
    else:
        risk_level = "low"

    daily_points = []
    for day_idx in range(1, horizon + 1):
        d = origin + dt.timedelta(days=day_idx)
        q10, q50, q90 = (int(v) for v in np.percentile(paths[:, day_idx], [10, 50, 90]))
        daily_points.append(DailyForecastPoint(
            date=d.isoformat(),
            p10_paisa=q10, p10_display=format_taka(q10, "bn"),
            p50_paisa=q50, p50_display=format_taka(q50, "bn"),
            p90_paisa=q90, p90_display=format_taka(q90, "bn"),
        ))

    data = ForecastData(
        horizon_days=horizon,
        as_of_date=origin.isoformat(),
        start_balance_paisa=start_balance,
        start_balance_display=format_taka(start_balance, "bn"),
        shortfall_prob=prob,
        shortfall_prob_display=format_probability(prob, "bn"),
        risk_level=risk_level,
        trough_date=trough_date_str,
        confidence=confidence,
        days=daily_points,
    )
    evidence = build_evidence(
        cfg,
        n_transactions=n_tx,
        labels={
            "shortfall_prob": "Prediction",
            "start_balance": "Data",
            "trough_date": "Prediction",
            "daily_quantiles": "Prediction",
        },
        forecast_version=load_latest_version(),
    )
    return data, evidence
