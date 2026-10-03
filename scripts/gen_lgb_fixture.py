#!/usr/bin/env python3
"""Generate a LightGBM prediction fixture to validate the TS predictor.

Reads the currently promoted model version from web/ml-artifacts/forecast/latest.json,
so the fixture always tracks whatever version the app serves. Paths are
repo-relative (this script lives in scripts/).
"""
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FORECAST_DIR = ROOT / "web" / "ml-artifacts" / "forecast"
VERSION = json.loads((FORECAST_DIR / "latest.json").read_text())["version"]
BASE = FORECAST_DIR / VERSION

rng = np.random.default_rng(42)

rows = []
# Random rows spanning plausible feature ranges (scale-free features)
X = rng.normal(0, 2, size=(24, 30))
# Inject missing values (NaN) to exercise the default_left path
X[5, 3] = np.nan
X[9, 10] = np.nan
X[13, 0] = np.nan
# A couple of extreme rows
X[20] = rng.uniform(-30, 200, size=30)
X[21] = np.zeros(30)

out = {"models": {}, "rows": None, "model_version": VERSION}
Xj = [[None if (isinstance(v, float) and np.isnan(v)) else float(v) for v in row] for row in X]
out["rows"] = Xj

for q in (10, 20, 30, 40, 50, 60, 70, 80, 90):
    m = lgb.Booster(model_file=str(BASE / f"model_q{q}.txt"))
    preds = m.predict(X)
    out["models"][f"q{q}"] = [float(p) for p in preds]

fixture = ROOT / "web" / "tests" / "fixtures" / "lgb-predictions.json"
fixture.write_text(json.dumps(out))
print(f"wrote fixture for {VERSION}: 24 rows x 9 quantile models -> {fixture}")
print("q50 first 3:", out["models"]["q50"][:3])
