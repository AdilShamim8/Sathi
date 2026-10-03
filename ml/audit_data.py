"""ml/audit_data.py — data + leakage audit for Sathi. Run from repo root:
    python ml/audit_data.py
Prints dataset size, transaction mix, and the shortfall base rate per persona
(why gig_driver / shopkeeper had no positives), plus leakage and hard-coded-metric checks.
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
FLOOR_DAYS = 3  # essentials floor = 3 days of median daily outflow (same idea as config)

tx = pd.read_parquet(ROOT / "data" / "transactions.parquet")
us = pd.read_parquet(ROOT / "data" / "users.parquet")
print("transactions columns:", list(tx.columns))
print("users columns:", list(us.columns))

amt = "amount_paisa" if "amount_paisa" in tx.columns else "amount"
bal = "balance_after_paisa" if "balance_after_paisa" in tx.columns else "balance_after"
tx["ts"] = pd.to_datetime(tx["ts"], utc=True).dt.tz_convert("Asia/Dhaka")
tx = tx.merge(us[["user_id", "persona"]], on="user_id", how="left")

print(f"\nusers={us.user_id.nunique()}  txns={len(tx):,}  "
      f"window={tx.ts.min().date()} → {tx.ts.max().date()}")
months = max((tx.ts.max() - tx.ts.min()).days / 30.4, 1)

print("\n== per persona ==")
inflow_types = {"salary_in", "remittance_in", "cash_in", "receive_money"}
rows = []
for p, g in tx.groupby("persona"):
    n_u = g.user_id.nunique()
    out = g[~g["type"].isin(inflow_types)]
    cash = g[g["type"] == "cash_out"]
    # end-of-day wallet balance per user
    g = g.sort_values("ts")
    eod = g.groupby(["user_id", g.ts.dt.date])[bal].last().rename("eod").reset_index()
    daily_out = (out.groupby(["user_id", out.ts.dt.date])[amt].sum()
                 .groupby("user_id").median().rename("med_out"))
    eod = eod.merge(daily_out, on="user_id", how="left")
    eod["below"] = eod["eod"] < FLOOR_DAYS * eod["med_out"].fillna(0)
    eod["month"] = pd.to_datetime(eod["ts"]).dt.to_period("M")
    cyc = eod.groupby(["user_id", "month"])["below"].any()
    rows.append({
        "persona": p, "users": n_u,
        "txn/user/month": round(len(g) / n_u / months, 1),
        "cash_out share of outflow value": round(cash[amt].sum() / max(out[amt].sum(), 1), 3),
        "days below floor": round(eod["below"].mean(), 3),
        "month-cycles with shortfall": round(cyc.mean(), 3),
    })
print(pd.DataFrame(rows).to_string(index=False))

print("\n== type mix (share of count) ==")
print(tx["type"].value_counts(normalize=True).round(3).to_string())

print("\n== leakage / integrity checks ==")
for f, pats in {
    "ml/train.py": [r"_income_dom\(", r"personas\[", r"ground_truth"],
    "ml/features.py": [r"personas\[", r"ground_truth", r"day_of_month"],
    "ml/benchmark.py": [r"DEFAULT_BENCHMARK", r"0\.082", r"24\.8"],
    "docs/eval_report.md": [r"0\.082", r"24\.8", r"32\.4%"],
}.items():
    path = ROOT / f
    if not path.exists():
        print(f"{f}: missing"); continue
    text = path.read_text(encoding="utf-8")
    hits = [p for p in pats if re.search(p, text)]
    print(f"{f}: {'FLAG ' + str(hits) if hits else 'clean'}")
