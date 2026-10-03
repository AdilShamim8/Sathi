"""`python -m ml.calibrate` — recalibrate P(shortfall) on held-out users (run after ml.train).

Simulated paths keep falling where real users adapt (skip payments, cut
spending near zero), so raw path probabilities overstate risk. A Platt map
(logistic regression on logit p) is fitted on validation + calibration users
only, for the model and — so the comparison stays fair — for the previous
bootstrap baseline. Saved into the model's calibration.json; ml.inference
applies it. Test users are never used.
"""
from __future__ import annotations

import datetime as dt
import json

import numpy as np
from sklearn.linear_model import LogisticRegression

from ml.evaluate import shortfall_frame
from ml.inference import ARTIFACTS, Forecaster
from ml.panel import festival_window, load_panels
from ml.train import load_dataset, split_users
from sathi_config import load_config


def logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(np.asarray(p, float), 1e-3, 1 - 1e-3)
    return np.log(p / (1 - p))


def fit_platt(p: np.ndarray, y: np.ndarray) -> dict[str, float]:
    lr = LogisticRegression(C=1e6).fit(logit(p)[:, None], y.astype(int))
    return {"a": float(lr.coef_[0, 0]), "b": float(lr.intercept_[0])}


def apply_platt(p, coef: dict | None) -> np.ndarray:
    if not coef:
        return np.asarray(p, float)
    return 1 / (1 + np.exp(-(coef["a"] * logit(p) + coef["b"])))


def main() -> None:
    cfg = load_config()
    ds = cfg.section("dataset")
    seed = int(ds["seed"])
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    tx, us, _ = load_dataset()
    splits = split_users(us["user_id"].tolist(), seed,
                         float(ds["splits"]["test_user_share"]), float(ds["splits"]["val_user_share"]))
    ids = [u for u, s in splits.items() if s in ("val", "cal")]
    fc = Forecaster()
    fc.calibration.pop("shortfall_platt", None)
    fc.calibration.pop("bootstrap_platt", None)
    first = as_of - dt.timedelta(days=int(ds["splits"]["time_test_days"]))
    df = shortfall_frame(fc, load_panels(tx, ids, as_of), festival_window(cfg), cfg, first, as_of,
                         us.set_index("user_id")["persona"], us.set_index("user_id")["income_band"], seed)
    y = df["label"].to_numpy(dtype=bool)
    fc.calibration["shortfall_platt"] = fit_platt(df["p_model"].to_numpy(), y)
    fc.calibration["bootstrap_platt"] = fit_platt(df["p_bootstrap"].to_numpy(), y)
    fc.calibration["shortfall_platt_n"] = len(df)
    path = ARTIFACTS / fc.version / "calibration.json"
    path.write_text(json.dumps(fc.calibration, indent=2), encoding="utf-8")
    print("platt", fc.calibration["shortfall_platt"], "bootstrap", fc.calibration["bootstrap_platt"], "n", len(df))


if __name__ == "__main__":
    main()
