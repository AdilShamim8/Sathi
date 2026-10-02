"""Feature builder for the daily net-flow forecaster.

Leakage rule: features for day t use only trailing history [t-lookback, t-1]
plus calendar facts. For future days the trailing aggregates are computed at
the forecast origin and held constant; only calendar features vary. The same
code path serves training and inference, so train/serve skew cannot appear.
"""
from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from core.timeutils import dhaka_date

LOOKBACK_DAYS = 30


def daily_flows(txns: pd.DataFrame, start: dt.date, end: dt.date) -> pd.DataFrame:
    """Per-user, per-Dhaka-date inflow/outflow sums, zero-filled on quiet days."""
    rows = []
    for user_id, g in txns.groupby("user_id"):
        dates = pd.to_datetime(g["ts"], utc=True).dt.tz_convert("Asia/Dhaka").dt.date
        inflow = g.loc[g["is_inflow"]].groupby(dates[g["is_inflow"]]).amount_paisa.sum()
        outflow = g.loc[~g["is_inflow"]].groupby(dates[~g["is_inflow"]]).amount_paisa.sum()
        d = start
        while d <= end:
            rows.append((user_id, d, int(inflow.get(d, 0)), int(outflow.get(d, 0))))
            d += dt.timedelta(days=1)
    return pd.DataFrame(rows, columns=["user_id", "date", "inflow_paisa", "outflow_paisa"])


def user_aggregates(daily: pd.DataFrame, origin: dt.date, lookback: int = LOOKBACK_DAYS) -> dict:
    """Trailing aggregates available at `origin` (no future data)."""
    hist = daily[daily["date"] < origin].tail(lookback)
    if hist.empty:
        return {"mean_in": 0.0, "mean_out": 0.0, "std_net": 0.0, "mean_net": 0.0,
                "n_days": 0}
    net = (hist["inflow_paisa"] - hist["outflow_paisa"]).to_numpy(dtype=float)
    return {
        "mean_in": float(hist["inflow_paisa"].mean()),
        "mean_out": float(hist["outflow_paisa"].mean()),
        "std_net": float(net.std()) if len(net) > 1 else 0.0,
        "mean_net": float(net.mean()),
        "n_days": int(len(hist)),
    }


def obligation_days(txns: pd.DataFrame, min_month_share: float = 0.6) -> dict[int, float]:
    """Recurring-obligation calendar: day-of-month -> mean amount, for
    obligation-type outflows seen in at least `min_month_share` of months."""
    ob = txns[(~txns["is_inflow"]) & (txns["type"].isin(["send_money", "bill_pay", "recharge"]))]
    if ob.empty:
        return {}
    tmp = ob.assign(dom=pd.to_datetime(ob["date"]).dt.day,
                    ym=pd.to_datetime(ob["date"]).dt.to_period("M"))
    share = tmp.groupby("dom")["ym"].nunique() / max(tmp["ym"].nunique(), 1)
    amounts = tmp.groupby("dom").amount_paisa.mean()
    return {int(d): float(amounts[d]) for d in share[share >= min_month_share].index}


FEATURE_COLUMNS = [
    "dom", "dow", "month", "is_month_end_week", "is_income_window",
    "days_to_income", "is_festival", "expected_obligation_paisa",
    "dom_net_profile",
    "mean_in", "mean_out", "std_net", "mean_net",
    "cashout_count_30d", "cashout_mean_30d", "days_since_cashout",
    "p_garment", "p_gig", "p_remittance", "p_shop", "p_student",
]


def cashout_trailing(txns: pd.DataFrame, start: dt.date, end: dt.date) -> pd.DataFrame:
    """Per-user, per-date trailing cash-out rhythm features (leakage-safe).

    Columns: cashout_count_30d and cashout_mean_30d over [t-30, t-1],
    days_since_cashout (capped at 30). Cash-outs are partly endogenous to
    balance and pay cycles, so their rhythm carries signal beyond calendar
    means.
    """
    co = txns[txns["type"] == "cash_out"]
    frames = []
    for user_id, g in co.groupby("user_id"):
        dates = pd.to_datetime(g["ts"], utc=True).dt.tz_convert("Asia/Dhaka").dt.date
        daily = g.groupby(dates)["amount_paisa"].sum()
        idx = pd.date_range(start, end, freq="D").date
        s = pd.Series([float(daily.get(d, 0.0)) for d in idx], index=idx)
        cnt = (s > 0).rolling(30, min_periods=1).sum().shift(1).fillna(0.0)
        amt = s.where(s > 0).rolling(30, min_periods=1).mean().shift(1)
        last = pd.Series(np.where(s > 0, np.arange(len(s)), np.nan), index=idx).ffill()
        since = (np.arange(len(s)) - last.to_numpy())
        since = pd.Series(np.where(np.isnan(since), 30.0, np.minimum(since, 30.0)), index=idx).shift(1).fillna(30.0)
        frames.append(pd.DataFrame({
            "user_id": user_id, "date": idx,
            "cashout_count_30d": cnt.to_numpy(dtype=float),
            "cashout_mean_30d": amt.fillna(0.0).to_numpy(dtype=float),
            "days_since_cashout": since.to_numpy(dtype=float),
        }))
    if not frames:
        return pd.DataFrame(columns=["user_id", "date", "cashout_count_30d",
                                     "cashout_mean_30d", "days_since_cashout"])
    return pd.concat(frames, ignore_index=True)


def dom_net_profile(daily: pd.DataFrame, before: dt.date) -> dict[int, float]:
    """Mean net flow per day-of-month, computed only on days < `before`.

    Captures 'salary on the 7th, rent on the 8th' per user without leakage.
    This is the inference/eval form: one dict frozen at the forecast origin.
    """
    hist = daily[daily["date"] < before]
    if hist.empty:
        return {}
    tmp = hist.assign(dom=pd.to_datetime(hist["date"]).dt.day)
    tmp = tmp.assign(net=tmp["inflow_paisa"] - tmp["outflow_paisa"])
    return {int(k): float(v) for k, v in tmp.groupby("dom")["net"].mean().items()}


def expanding_dom_profiles(daily: pd.DataFrame) -> pd.Series:
    """Per-row mean historical net for the row's day-of-month, using only
    days from strictly earlier months. Leakage-safe training form of
    `dom_net_profile` (rows early in a user's history get NaN -> 0.0,
    matching cold start at serve time)."""
    tmp = daily.assign(dom=pd.to_datetime(daily["date"]).dt.day,
                       ym=pd.to_datetime(daily["date"]).dt.to_period("M"),
                       net=daily["inflow_paisa"] - daily["outflow_paisa"]).reset_index(drop=True)
    monthly = (tmp.groupby(["dom", "ym"], observed=True)["net"].mean()
               .reset_index().sort_values("ym"))
    monthly["profile"] = (monthly.groupby("dom")["net"]
                          .transform(lambda s: s.expanding().mean().shift(1)))
    merged = tmp.merge(monthly[["dom", "ym", "profile"]], on=["dom", "ym"], how="left")
    return pd.Series(merged["profile"].to_numpy(), index=daily.index)

_PERSONA_FLAGS = {
    "garment_worker": "p_garment", "gig_driver": "p_gig",
    "remittance_household": "p_remittance", "shopkeeper": "p_shop", "student": "p_student",
}


def build_feature_row(d: dt.date, aggregates: dict, income_dom: int | None,
                      obligations: dict[int, float], festival: set[str],
                      persona: str, dom_profile: dict[int, float] | None = None) -> dict[str, float]:
    """One feature row for date d. Pure over its arguments."""
    row = {c: 0.0 for c in FEATURE_COLUMNS}
    row["dom"] = d.day
    row["dow"] = d.weekday()
    row["month"] = d.month
    row["is_month_end_week"] = 1.0 if d.day >= 25 else 0.0
    if income_dom is not None:
        next_income = d.replace(day=min(income_dom, 28))
        if next_income <= d:
            next_income = (d.replace(day=28) + dt.timedelta(days=8)).replace(day=min(income_dom, 28))
        row["days_to_income"] = float((next_income - d).days)
        row["is_income_window"] = 1.0 if abs(d.day - income_dom) <= 2 else 0.0
    row["is_festival"] = 1.0 if d.isoformat() in festival else 0.0
    row["expected_obligation_paisa"] = float(obligations.get(d.day, 0.0))
    row["dom_net_profile"] = float((dom_profile or {}).get(d.day, 0.0))
    row["mean_in"] = aggregates["mean_in"]
    row["mean_out"] = aggregates["mean_out"]
    row["std_net"] = aggregates["std_net"]
    row["mean_net"] = aggregates["mean_net"]
    row["cashout_count_30d"] = float(aggregates.get("cashout_count_30d", 0.0))
    row["cashout_mean_30d"] = float(aggregates.get("cashout_mean_30d", 0.0))
    row["days_since_cashout"] = float(aggregates.get("days_since_cashout", 30.0))
    row[_PERSONA_FLAGS[persona]] = 1.0
    return row
