"""Inference for the irregular-flow quantile forecaster (offline-trained only).

One call turns a user's transaction history into simulated wallet paths:

  1. ml.panel builds the leakage-safe origin features (history <= origin),
  2. the 9 LightGBM quantile models predict the daily irregular net flow,
     sorted (no crossing) and widened by the split-conformal correction,
  3. core.recurring.detect_streams finds salary/rent/bill streams,
  4. core.simulation draws block-correlated paths (rho from calibration).

Everything user-facing is a functional of those paths: P(shortfall), trough
day, daily balance bands and the model-based safe-to-spend. The same code
path serves the API and the evaluation, so train/serve skew cannot appear.
No thresholds or wording here (code-standards §3).
"""
from __future__ import annotations

import datetime as dt
import json
import zlib
from dataclasses import dataclass
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from core.safe_to_spend import safe_to_spend_from_paths
from core.simulation import sample_stream_flows, simulate_liquidity_paths
from ml.panel import FEATURES, TAUS, OriginFeatures, UserPanel, build_panel

ARTIFACTS = Path(__file__).parent / "artifacts" / "forecast"
CASH_FEATURES = ("cash_est", "cash_tc_days", "cashout_7", "days_since_cashout")
CALENDAR_FEATURES = ("k", "dow", "dom", "is_month_end", "is_festival")


def load_latest_version(artifacts_dir: Path = ARTIFACTS) -> str:
    return json.loads((artifacts_dir / "latest.json").read_text())["version"]


def load_metadata(artifacts_dir: Path = ARTIFACTS) -> dict:
    version = load_latest_version(artifacts_dir)
    return json.loads((artifacts_dir / version / "metadata.json").read_text())


def stable_seed(*parts) -> int:
    """Process-independent seed (Python's hash() is salted per process)."""
    return zlib.crc32("|".join(str(p) for p in parts).encode())


@dataclass(frozen=True)
class UserForecast:
    model_version: str
    origin: dt.date
    horizon_days: int
    paths: np.ndarray               # (P, H+1) wallet balance paths, paisa
    floor_paisa: int
    window_days: int                # shortfall window used for p_shortfall
    p_shortfall: float              # P(balance < floor within window_days)
    trough_day: int | None          # median argmin day (1 = tomorrow)
    safe_to_spend_paisa: int        # Q_0.10(min balance over window) - floor
    days_to_income: int
    cash_on_hand_paisa: int
    irregular_quantiles: np.ndarray  # (H, T) paisa
    confidence: str                  # "normal" | "low"


def recalibrate(p: float, coef: dict | None) -> float:
    """Platt map fitted on held-out users (ml/calibrate.py); identity if absent."""
    if not coef:
        return p
    q = min(max(p, 1e-3), 1 - 1e-3)
    z = coef["a"] * np.log(q / (1 - q)) + coef["b"]
    return float(1 / (1 + np.exp(-z)))


class Forecaster:
    """Loads versioned boosters + calibration once."""

    def __init__(self, artifacts_dir: Path = ARTIFACTS, version: str | None = None):
        self.version = version or load_latest_version(artifacts_dir)
        folder = artifacts_dir / self.version
        self.metadata = json.loads((folder / "metadata.json").read_text())
        self.calibration = json.loads((folder / "calibration.json").read_text())
        self.boosters = {float(t): lgb.Booster(model_file=str(folder / f"model_q{int(round(t * 100)):02d}.txt"))
                         for t in TAUS}

    def quantiles(self, X: np.ndarray, conformal: bool = True) -> np.ndarray:
        """(n, T) scale-free quantiles: sorted, then conformally widened."""
        q = np.sort(np.column_stack([self.boosters[float(t)].predict(X) for t in TAUS]), axis=1)
        if conformal:
            q = q + float(self.calibration["conformal_widen_scaled"]) * (TAUS - 0.5) / 0.4
        return q

    def forecast_panel(self, panel: UserPanel, origin: dt.date, horizon: int, *,
                       festival: set[str], floor_days: int, n_paths: int, seed: int,
                       window_days: int | None = None, alpha: float = 0.10,
                       conformal: bool = True, rho: float | None = None,
                       use_streams: bool = True, use_cash: bool = True,
                       feature_noise: float = 0.0,
                       min_history_days: int = 30) -> UserForecast:
        """Forecast from the end of `origin` (all data <= origin is known)."""
        i = panel.index_of(origin)
        fb = OriginFeatures(panel, festival)
        streams = panel.streams_at(origin)
        state = fb.origin_state(i, streams)
        if not use_cash:
            for c in CASH_FEATURES:
                state[c] = 0.0
        rows = fb.target_rows(state, origin, range(1, horizon + 1))
        X = pd.DataFrame(rows)[FEATURES].to_numpy(dtype=float)
        if feature_noise > 0:
            # Robustness check only: perturb continuous origin features.
            noise_rng = np.random.default_rng(seed + 1)
            cols = [FEATURES.index(c) for c in FEATURES if c not in CALENDAR_FEATURES]
            X[:, cols] *= 1 + feature_noise * noise_rng.standard_normal(len(cols))
        scale = fb.scale(i)
        q = self.quantiles(X, conformal) * scale                      # (H, T) paisa

        rng = np.random.default_rng(seed)
        sched = sample_stream_flows(streams, origin, horizon, n_paths, rng)
        if not use_streams:
            # Ablation: same total scheduled money, spread evenly (no timing).
            sched = np.repeat(np.rint(sched.sum(axis=1, keepdims=True) / horizon).astype(np.int64),
                              horizon, axis=1)
        start = panel.eod_balance[i]
        start = 0 if np.isnan(start) else int(start)
        paths = simulate_liquidity_paths(
            start, q, TAUS, sched,
            float(self.calibration["rho"]) if rho is None else rho,
            int(self.calibration["block_days"]), rng)

        floor = int(fb.floor(i, floor_days))
        to_income = int(state["_timing"].days_to_next_income) + 1   # days from origin
        window = window_days if window_days is not None else int(np.clip(to_income, 7, horizon))
        mins = paths[:, 1:window + 1].min(axis=1)
        p = recalibrate(float(np.mean(mins < floor)), self.calibration.get("shortfall_platt"))
        trough = int(np.median(paths[:, 1:window + 1].argmin(axis=1) + 1))
        cash, _ = fb.cash_estimate(i, streams)
        return UserForecast(
            model_version=self.version, origin=origin, horizon_days=horizon, paths=paths,
            floor_paisa=floor, window_days=window, p_shortfall=p, trough_day=trough,
            safe_to_spend_paisa=safe_to_spend_from_paths(paths[:, : window + 1], floor, alpha),
            days_to_income=to_income, cash_on_hand_paisa=int(cash),
            irregular_quantiles=q,
            confidence="low" if i + 1 < min_history_days else "normal",
        )

    def forecast_transactions(self, user_id: str, user_tx: pd.DataFrame, origin: dt.date,
                              horizon: int, **kw) -> UserForecast:
        """user_tx: one user's transactions (ts, type, amount_paisa, fee_paisa,
        counterparty_id, balance_after_paisa). Rows after `origin` are ignored."""
        local = pd.to_datetime(user_tx["ts"], utc=True).dt.tz_convert("Asia/Dhaka").dt.date
        panel = build_panel(user_id, user_tx[local <= origin], origin)
        return self.forecast_panel(panel, origin, horizon, **kw)
