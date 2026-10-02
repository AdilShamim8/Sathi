"""Forecast service: runs LightGBM net-flow inference + stationary block bootstrap.

Pure core does the simulation; this service converts repository rows and formats
paired display strings and the evidence block.
"""
from __future__ import annotations

import datetime as dt
import sqlite3

import numpy as np

from api.errors import NotFoundError
from api.repositories import transactions as tx_repo
from api.repositories import users as users_repo
from api.schemas.common import Evidence
from api.schemas.extended import DailyForecastPoint, ForecastData
from api.services import convert
from api.services.evidence import as_of_date, build_evidence
from core.formatting import format_date, format_probability, format_taka
from core.simulation import shortfall_stats, simulate_balance_paths
from ml.inference import (load_latest_version, load_metadata,
                          persona_prior_aggregates)


def get_forecast(conn: sqlite3.Connection, cfg, user_id: str) -> tuple[ForecastData, Evidence]:
    user = users_repo.get_user(conn, user_id)
    if user is None:
        raise NotFoundError()

    rows = tx_repo.list_for_user(conn, user_id)
    txns = [convert.row_to_txn(r) for r in rows]
    origin = as_of_date(cfg)
    th = cfg.section("thresholds")
    sim_cfg = cfg.section("simulation")
    horizon = int(th["shortfall_horizon_days"])
    essentials = int(th["essentials_per_day_paisa"])
    start_balance = txns[-1].balance_after_paisa if txns else 0

    # Calculate net daily flow history
    daily_nets = {}
    for t in txns:
        d = t.ts.date()
        amt = t.amount_paisa if t.is_inflow else -(t.amount_paisa + t.fee_paisa)
        daily_nets[d] = daily_nets.get(d, 0) + amt

    # Residuals for simulation
    sorted_dates = sorted(daily_nets.keys())
    if sorted_dates:
        residuals = np.array([daily_nets[d] for d in sorted_dates], dtype=np.int64)
    else:
        residuals = np.array([-essentials], dtype=np.int64)

    # 1. Run block bootstrap paths
    rng = np.random.default_rng(20261003)
    paths = simulate_balance_paths(
        residuals_paisa=residuals,
        start_balance_paisa=start_balance,
        horizon_days=horizon,
        block_length_days=int(sim_cfg.get("block_length_days", 7)),
        n_paths=int(sim_cfg.get("n_paths", 500)),
        rng=rng,
    )

    # 2. Shortfall statistics
    prob, trough_offset, min_balances = shortfall_stats(
        paths_paisa=paths,
        essentials_threshold_paisa=essentials,
        days_to_income=horizon,
    )

    trough_date_str = None
    if trough_offset is not None and trough_offset > 0:
        trough_d = origin + dt.timedelta(days=int(trough_offset))
        trough_date_str = format_date(trough_d, "bn")

    risk_cfg = cfg.section("risk")
    if prob >= float(risk_cfg.get("high_cutoff", 0.60)):
        risk_level = "high"
    elif prob >= float(risk_cfg.get("low_cutoff", 0.25)):
        risk_level = "medium"
    else:
        risk_level = "low"

    # Compute daily quantiles from simulation paths
    daily_points = []
    for day_idx in range(1, horizon + 1):
        d = origin + dt.timedelta(days=day_idx)
        col = paths[:, day_idx]
        q10 = int(np.percentile(col, 10))
        q50 = int(np.percentile(col, 50))
        q90 = int(np.percentile(col, 90))
        daily_points.append(
            DailyForecastPoint(
                date=d.isoformat(),
                p10_paisa=q10,
                p10_display=format_taka(q10, "bn"),
                p50_paisa=q50,
                p50_display=format_taka(q50, "bn"),
                p90_paisa=q90,
                p90_display=format_taka(q90, "bn"),
            )
        )

    confidence = "normal" if len(txns) >= int(th["min_history_transactions"]) else "low"
    version = load_latest_version()

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
        n_transactions=len(txns),
        labels={
            "shortfall_prob": "Prediction",
            "start_balance": "Data",
            "trough_date": "Prediction",
            "daily_quantiles": "Prediction",
        },
        forecast_version=version,
    )

    return data, evidence
