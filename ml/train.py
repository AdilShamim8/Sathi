"""`python -m ml.train` — train the quantile forecaster (offline only).

Trains one pooled LightGBM model per quantile (p10/p50/p90) on daily net
flows of TRAIN users only, over the training time window. The frozen test
users and the trailing time-test days are never touched here. Writes
ml/artifacts/forecast/<version>/ with metadata.json (hash, seed, config).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from ml.features import (FEATURE_COLUMNS, build_feature_row, cashout_trailing,
                         daily_flows, expanding_dom_profiles, obligation_days)
from sathi_config import load_config

ARTIFACTS = Path(__file__).parent / "artifacts" / "forecast"
DATA = Path(__file__).parent.parent / "data"

QUANTILES = (0.1, 0.5, 0.9)
MIN_TRAILING_DAYS = 10


def load_dataset() -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    tx = pd.read_parquet(DATA / "transactions.parquet")
    us = pd.read_parquet(DATA / "users.parquet")
    meta = json.loads((DATA / "dataset_meta.json").read_text())
    tx["is_inflow"] = tx["type"].isin(["salary_in", "remittance_in", "cash_in"])
    return tx, us, meta


def split_users(users: list[str], seed: int, test_share: float, val_share: float) -> dict[str, str]:
    """User-level split by seeded shuffle of sorted ids. Test users are frozen."""
    order = np.array(sorted(users))
    rng = np.random.default_rng(seed)
    rng.shuffle(order)
    n = len(order)
    n_test = int(n * test_share)
    n_val = int(n * val_share)
    out = {}
    for i, u in enumerate(order):
        out[u] = "test" if i < n_test else ("val" if i < n_test + n_val else "train")
    return out


def _festival_set(cfg) -> set[str]:
    return set(cfg.section("calendar")["festival_days"])


def _income_dom(personas: dict, persona: str) -> int | None:
    for stream in personas[persona]["income_streams"]:
        if "day_of_month" in stream:
            return int(stream["day_of_month"])
    return None


def build_frame(tx: pd.DataFrame, us: pd.DataFrame, cfg, user_ids: set[str],
                start: dt.date, end: dt.date, min_trailing: int = MIN_TRAILING_DAYS) -> pd.DataFrame:
    """Feature rows + target for the given users and day window.

    Trailing aggregates are computed with a vectorized rolling window shifted
    by one day (features at day t see days [t-30, t-1] — no leakage).
    """
    ds = cfg.section("dataset")
    personas = cfg.section("personas")
    festival = _festival_set(cfg)
    window_start = dt.date.fromisoformat(ds["start_date"])
    as_of = dt.date.fromisoformat(ds["as_of_date"])

    sub = tx[tx["user_id"].isin(user_ids)]
    flows = daily_flows(sub, window_start, as_of)
    flows = flows.merge(us[["user_id", "persona"]], on="user_id")
    co = cashout_trailing(sub, window_start, as_of)
    flows = flows.merge(co, on=["user_id", "date"], how="left")
    for c in ("cashout_count_30d", "cashout_mean_30d", "days_since_cashout"):
        flows[c] = flows[c].fillna(30.0 if c == "days_since_cashout" else 0.0)

    frames = []
    for user_id, g in flows.groupby("user_id"):
        g = g.sort_values("date").reset_index(drop=True)
        g["net"] = g["inflow_paisa"] - g["outflow_paisa"]
        # Trailing (shifted) rolling stats: at row t they cover [t-30, t-1].
        g["mean_in"] = g["inflow_paisa"].rolling(30, min_periods=min_trailing).mean().shift(1)
        g["mean_out"] = g["outflow_paisa"].rolling(30, min_periods=min_trailing).mean().shift(1)
        g["std_net"] = g["net"].rolling(30, min_periods=min_trailing).std().shift(1)
        g["mean_net"] = g["net"].rolling(30, min_periods=min_trailing).mean().shift(1)
        persona = g["persona"].iloc[0]
        income_dom = _income_dom(personas, persona)
        # Leakage-safe per-row day-of-month profile: each row sees only the
        # mean nets of its day-of-month from strictly earlier months.
        g["dom_profile"] = expanding_dom_profiles(g[["date", "inflow_paisa", "outflow_paisa"]])
        user_tx = sub[sub["user_id"] == user_id].assign(
            date=pd.to_datetime(sub[sub["user_id"] == user_id]["ts"], utc=True).dt.tz_convert("Asia/Dhaka").dt.date
        )
        obligations = obligation_days(user_tx)
        rows = []
        for _, r in g.iterrows():
            d = r["date"]
            if not (start <= d <= end):
                continue
            if pd.isna(r["mean_in"]):
                continue
            prof_val = r["dom_profile"]
            feats = build_feature_row(
                d,
                {"mean_in": r["mean_in"], "mean_out": r["mean_out"],
                 "std_net": r["std_net"] if not pd.isna(r["std_net"]) else 0.0,
                 "mean_net": r["mean_net"], "n_days": 30,
                 "cashout_count_30d": r["cashout_count_30d"],
                 "cashout_mean_30d": r["cashout_mean_30d"],
                 "days_since_cashout": r["days_since_cashout"]},
                income_dom, obligations, festival, persona,
                dom_profile={} if pd.isna(prof_val) else {d.day: float(prof_val)},
            )
            feats["user_id"] = user_id
            feats["date"] = d
            feats["target_net_paisa"] = r["net"]
            rows.append(feats)
        if rows:
            frames.append(pd.DataFrame(rows))
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def train() -> str:
    cfg = load_config()
    ds = cfg.section("dataset")
    seed = int(ds["seed"])
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    tx, us, meta = load_dataset()

    splits = split_users(us["user_id"].tolist(), seed,
                         float(ds["splits"]["test_user_share"]), float(ds["splits"]["val_user_share"]))
    train_users = {u for u, s in splits.items() if s == "train"}
    time_test_days = int(ds["splits"]["time_test_days"])
    train_end = as_of - dt.timedelta(days=time_test_days)
    window_start = dt.date.fromisoformat(ds["start_date"])

    frame = build_frame(tx, us, cfg, train_users, window_start, train_end)
    X = frame[FEATURE_COLUMNS].to_numpy(dtype=float)
    # Residual target: the model learns adjustments on top of the trailing
    # mean net (the naive baseline), so where no signal exists it naturally
    # falls back to the baseline instead of adding variance.
    y = (frame["target_net_paisa"] - frame["mean_net"]).to_numpy(dtype=float)

    version = f"fc-{as_of.isoformat()}-{hashlib.sha256(X.tobytes()).hexdigest()[:8]}"
    out_dir = ARTIFACTS / version
    out_dir.mkdir(parents=True, exist_ok=True)

    params = {"objective": "quantile", "learning_rate": 0.03, "num_leaves": 63,
              "n_estimators": 800, "min_child_samples": 40, "feature_fraction": 0.9,
              "seed": seed, "verbose": -1}
    for q in QUANTILES:
        model = lgb.LGBMRegressor(alpha=q, **params)
        model.fit(X, y)
        model.booster_.save_model(str(out_dir / f"model_q{int(q * 100)}.txt"))

    metadata = {
        "model": "forecast",
        "version": version,
        "quantiles": list(QUANTILES),
        "seed": seed,
        "config_hash": cfg.config_hash,
        "data_hash": meta["transactions_hash"],
        "as_of_date": ds["as_of_date"],
        "n_train_rows": int(len(frame)),
        "n_train_users": len(train_users),
        "feature_columns": FEATURE_COLUMNS,
        "trained_at_window": [window_start.isoformat(), train_end.isoformat()],
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    # 'latest' pointer file (no symlinks on some filesystems).
    (ARTIFACTS / "latest.json").write_text(json.dumps({"version": version}), encoding="utf-8")
    print(f"trained {version}: rows={len(frame)} users={len(train_users)}")
    return version


if __name__ == "__main__":
    train()
