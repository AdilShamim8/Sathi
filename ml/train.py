"""`python -m ml.train` — train the irregular-flow quantile forecaster (offline only).

Model (docs/ML_PLAN.md §4.2): one global LightGBM model per quantile
tau in {0.1, ..., 0.9} of the scale-free daily IRREGULAR net flow
(ml/panel.py), trained direct multi-horizon on (origin, k) rows of TRAIN
users. Early stopping uses validation users ("val_es"). Calibration users
("cal", never seen in fitting) are used for

  1. split-conformal widening of the band (CQR, Romano et al. 2019), and
  2. the within-week correlation rho of the path simulator, chosen so the
     80% band of the 28-day cumulative irregular flow covers ~80%.

Frozen test users are never touched here. Writes
ml/artifacts/forecast/<version>/ (boosters, calibration.json, metadata.json).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from core.simulation import block_correlated_uniforms, inverse_cdf
from ml.panel import (
    FEATURES,
    TAUS,
    OriginFeatures,
    festival_window,
    load_panels,
    training_rows,
)
from sathi_config import load_config

ARTIFACTS = Path(__file__).parent / "artifacts" / "forecast"
DATA = Path(__file__).parent.parent / "data"

HORIZON = 35
TARGET_COVERAGE = 0.80
RHO_GRID = (0.0, 0.2, 0.4, 0.6, 0.8)
BLOCK_DAYS = 7
PARAMS = {"objective": "quantile", "learning_rate": 0.05, "num_leaves": 31,
          "min_child_samples": 50, "feature_fraction": 0.8, "bagging_fraction": 0.8,
          "bagging_freq": 1, "n_estimators": 2000, "verbose": -1}


def load_dataset(data_dir: Path = DATA) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    tx = pd.read_parquet(data_dir / "transactions.parquet")
    us = pd.read_parquet(data_dir / "users.parquet")
    meta = json.loads((data_dir / "dataset_meta.json").read_text())
    tx["is_inflow"] = tx["type"].isin(["salary_in", "remittance_in", "cash_in"])
    return tx, us, meta


def dhaka_dates(ts: pd.Series) -> pd.Series:
    return pd.to_datetime(ts, utc=True).dt.tz_convert("Asia/Dhaka").dt.date


def split_users(users: list[str], seed: int, test_share: float, val_share: float) -> dict[str, str]:
    """User-level split by seeded shuffle of sorted ids. Test users are frozen.
    Validation users alternate between early stopping ("val") and conformal
    calibration ("cal")."""
    order = np.array(sorted(users))
    rng = np.random.default_rng(seed)
    rng.shuffle(order)
    n = len(order)
    n_test = int(n * test_share)
    n_val = int(n * val_share)
    out = {}
    for i, u in enumerate(order):
        if i < n_test:
            out[u] = "test"
        elif i < n_test + n_val:
            out[u] = "val" if (i - n_test) % 2 == 0 else "cal"
        else:
            out[u] = "train"
    return out


def pinball(y: np.ndarray, q: np.ndarray, taus: np.ndarray = TAUS) -> float:
    """Mean pinball loss over rows and quantiles. y: (n,), q: (n, T)."""
    diff = y[:, None] - q
    return float(np.mean(np.maximum(taus * diff, (taus - 1) * diff)))


def predict_raw(boosters: dict[float, lgb.Booster], X: np.ndarray) -> np.ndarray:
    """(n, T) predictions, sorted per row so quantiles never cross."""
    return np.sort(np.column_stack([boosters[t].predict(X) for t in TAUS]), axis=1)


def conformalize(q: np.ndarray, widen: float) -> np.ndarray:
    """Widen the band symmetrically in proportion to distance from the median:
    q10/q90 move by `widen`, inner quantiles proportionally (CQR)."""
    return q + widen * (TAUS - 0.5) / 0.4


def conformal_widening(y: np.ndarray, q: np.ndarray, coverage: float = TARGET_COVERAGE) -> float:
    """Split-conformal correction for the [q10, q90] band (Romano et al. 2019)."""
    scores = np.maximum(q[:, 0] - y, y - q[:, -1])
    n = len(scores)
    level = min(np.ceil((n + 1) * coverage) / n, 1.0)
    return float(np.quantile(scores, level, method="higher"))


def full_horizon_rows(panels, festival, first_origin: dt.date, last_target: dt.date,
                      horizon: int, origin_every: int) -> pd.DataFrame:
    """All k = 1..horizon rows for weekly-ish origins (for calibration/eval)."""
    rows = []
    for u, p in sorted(panels.items()):
        fb = OriginFeatures(p, festival)
        for i in range(len(p.dates)):
            d0 = p.dates[i]
            if d0 < first_origin or (d0 - first_origin).days % origin_every or i < 30:
                continue
            if (last_target - d0).days < horizon:
                break
            state = fb.origin_state(i)
            s = fb.scale(i)
            for r, k in zip(fb.target_rows(state, d0, range(1, horizon + 1)), range(1, horizon + 1)):
                r.update(user_id=u, origin=d0, target=float(p.irr_net[i + k] / s), scale=s)
                rows.append(r)
    return pd.DataFrame(rows)


def choose_rho(cal: pd.DataFrame, q: np.ndarray, horizon: int, seed: int,
               n_paths: int = 400) -> tuple[float, dict[str, float]]:
    """Pick the block correlation whose 80% band of the cumulative irregular
    flow over `horizon` days covers closest to 80% on calibration users."""
    rng = np.random.default_rng(seed)
    groups = list(cal.groupby(["user_id", "origin"]).indices.values())
    cover = {}
    for rho in RHO_GRID:
        hits = []
        for idx in groups:
            idx = np.sort(idx)[:horizon]
            u = block_correlated_uniforms(n_paths, len(idx), rho, BLOCK_DAYS, rng)
            sims = inverse_cdf(q[idx], TAUS, u).sum(axis=1)
            lo, hi = np.quantile(sims, [0.1, 0.9])
            actual = cal["target"].to_numpy()[idx].sum()
            hits.append(lo <= actual <= hi)
        cover[str(rho)] = float(np.mean(hits))
    best = min(RHO_GRID, key=lambda r: abs(cover[str(r)] - TARGET_COVERAGE))
    return float(best), cover


def train() -> str:
    cfg = load_config()
    ds = cfg.section("dataset")
    seed = int(ds["seed"])
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    tx, us, meta = load_dataset()
    splits = split_users(us["user_id"].tolist(), seed,
                         float(ds["splits"]["test_user_share"]), float(ds["splits"]["val_user_share"]))
    time_test_days = int(ds["splits"]["time_test_days"])
    train_end = as_of - dt.timedelta(days=time_test_days)       # last training target day
    eval_first_origin = train_end - dt.timedelta(days=HORIZON)  # origins whose window ends in the eval period
    festival = festival_window(cfg)

    by_split = {s: [u for u, v in splits.items() if v == s] for s in ("train", "val", "cal")}
    panels = {s: load_panels(tx, ids, as_of) for s, ids in by_split.items()}

    tr = training_rows(panels["train"], festival, train_end, HORIZON, 4, 6, seed)
    va = training_rows(panels["val"], festival, as_of, HORIZON, 4, 6, seed + 1,
                       first_origin=eval_first_origin)
    Xtr, ytr = tr[FEATURES].to_numpy(dtype=float), tr["target"].to_numpy(dtype=float)
    Xva, yva = va[FEATURES].to_numpy(dtype=float), va["target"].to_numpy(dtype=float)

    version = f"fc-{as_of.isoformat()}-{hashlib.sha256(Xtr.tobytes()).hexdigest()[:8]}"
    out_dir = ARTIFACTS / version
    out_dir.mkdir(parents=True, exist_ok=True)

    boosters: dict[float, lgb.Booster] = {}
    best_iters = {}
    for tau in TAUS:
        model = lgb.LGBMRegressor(alpha=float(tau), random_state=seed, **PARAMS)
        model.fit(Xtr, ytr, eval_set=[(Xva, yva)], eval_metric="quantile",
                  callbacks=[lgb.early_stopping(50, verbose=False)])
        boosters[float(tau)] = model.booster_
        best_iters[str(tau)] = int(model.best_iteration_ or PARAMS["n_estimators"])
        model.booster_.save_model(str(out_dir / f"model_q{int(round(tau * 100)):02d}.txt"),
                                  num_iteration=model.best_iteration_)
        print(f"tau={tau:.1f} best_iter={best_iters[str(tau)]}")

    # --- calibration on held-out calibration users ------------------------
    cal = full_horizon_rows(panels["cal"], festival, eval_first_origin, as_of, HORIZON, 7)
    q_cal = predict_raw(boosters, cal[FEATURES].to_numpy(dtype=float))
    y_cal = cal["target"].to_numpy(dtype=float)
    cover_raw = float(np.mean((y_cal >= q_cal[:, 0]) & (y_cal <= q_cal[:, -1])))
    widen = conformal_widening(y_cal, q_cal)
    q_cal_c = conformalize(q_cal, widen)
    rho, rho_cover = choose_rho(cal, q_cal_c, 28, seed)
    calibration = {
        "taus": [float(t) for t in TAUS],
        "conformal_widen_scaled": widen,
        "daily_coverage_p10_p90_raw_cal": cover_raw,
        "rho": rho,
        "rho_grid_coverage_28d": rho_cover,
        "block_days": BLOCK_DAYS,
        "n_cal_rows": len(cal),
    }
    (out_dir / "calibration.json").write_text(json.dumps(calibration, indent=2), encoding="utf-8")

    metadata = {
        "model": "forecast-irregular-quantile",
        "version": version,
        "quantiles": [float(t) for t in TAUS],
        "horizon_days": HORIZON,
        "seed": seed,
        "config_hash": cfg.config_hash,
        "data_hash": meta["transactions_hash"],
        "as_of_date": ds["as_of_date"],
        "n_train_rows": len(tr),
        "n_train_users": len(by_split["train"]),
        "n_val_rows": len(va),
        "feature_columns": FEATURES,
        "best_iterations": best_iters,
        "val_pinball": pinball(yva, predict_raw(boosters, Xva)),
        "train_targets_until": train_end.isoformat(),
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (ARTIFACTS / "latest.json").write_text(json.dumps({"version": version}), encoding="utf-8")
    print(f"trained {version}: rows={len(tr)} users={len(by_split['train'])} "
          f"widen={widen:.3f} raw_cal_cov={cover_raw:.3f} rho={rho} {rho_cover}")
    return version


if __name__ == "__main__":
    train()
