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

    # --- liquidity basis: wallet + user-corrected cash + other liquid funds ---
    from api.services.inputs_service import effective_cash_on_hand, get_inputs
    from api.services.convert import row_to_txn
    tx_rows = conn.execute(
        "SELECT * FROM transactions WHERE user_id = ? ORDER BY ts", (user_id,)).fetchall()
    txns = [row_to_txn(r) for r in tx_rows]
    inputs = get_inputs(conn, user_id)
    eff_cash, cash_source = effective_cash_on_hand(
        txns, origin, inputs.cash_on_hand_paisa, inputs.cash_on_hand_as_of)
    other_liquid = inputs.other_liquid_paisa or 0
    liquidity_basis = {
        "wallet_balance_paisa": start_balance,
        "cash_on_hand_paisa": int(eff_cash),
        "other_liquid_paisa": int(other_liquid),
        "total_liquid_paisa": int(max(0, start_balance) + max(0, eff_cash) + max(0, other_liquid)),
        "cash_source": cash_source,
    }

    # --- safe-to-spend + daily allowance (mission contract) ---
    safe_total = int(f.safe_to_spend_paisa) if f is not None else None
    window = int(f.window_days) if f is not None else horizon
    daily_allowance = int(safe_total / max(window, 1)) if safe_total is not None else None

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

    # --- top action (counterfactual engine, same simulated paths) ---
    top_action = None
    try:
        from api.services.actions_service import get_actions
        acts = get_actions(conn, cfg, user_id)
        if acts.actions:
            best = acts.actions[0]
            top_action = {
                "action_id": best.action_id,
                "title_bn": best.title_bn,
                "title_en": best.title_en,
                "delta_shortfall_prob": best.delta_shortfall_prob,
                "shortfall_prob_after": best.shortfall_prob_after,
            }
    except Exception:
        top_action = None  # never let the action engine break the forecast

    days_to_income = int(f.days_to_income) if f is not None else None
    next_income_date = None
    if days_to_income is not None and 1 <= days_to_income <= 90:
        next_income_date = (origin + dt.timedelta(days=days_to_income)).isoformat()

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
        days_to_next_income=days_to_income,
        next_income_date=next_income_date,
        safe_to_spend_paisa=safe_total,
        safe_to_spend_display=format_taka(safe_total, "bn") if safe_total is not None else None,
        daily_allowance_paisa=daily_allowance,
        daily_allowance_display=format_taka(daily_allowance, "bn") if daily_allowance is not None else None,
        liquidity_basis=liquidity_basis,
        top_action=top_action,
        method="lightgbm-quantile + recurring streams + calibrated paths" if f is not None else "none",
        model_version=load_latest_version() if f is not None else None,
    )
    evidence = build_evidence(
        cfg,
        n_transactions=n_tx,
        labels={
            "shortfall_prob": "Prediction",
            "start_balance": "Data",
            "trough_date": "Prediction",
            "daily_quantiles": "Prediction",
            "safe_to_spend": "Prediction",
            "daily_allowance": "Prediction",
            "liquidity_basis": "Data",
            "top_action": "Prediction",
        },
        forecast_version=load_latest_version(),
    )
    return data, evidence
