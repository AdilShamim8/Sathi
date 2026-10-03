"""Per-user daily panel and leakage-safe features for the irregular-flow model.

Decomposition (docs/ML_PLAN.md §4.2):

    daily wallet net = scheduled streams   (core.recurring.detect_streams)
                     + irregular net flow  (LightGBM quantile model, this file)

"Irregular" = every transaction that is not part of a detected recurring
stream: everyday spending, cash-outs, daily earnings, shocks, one-off
transfers. Its daily net is divided by a per-user scale (mean daily irregular
gross flow over the 90 days before the origin) so one global model serves
users of every income level.

An origin is the END of a day d0: everything dated <= d0 is known (including
that day's closing balance); forecasts cover d0+1 .. d0+H. Every feature is
computed from days <= d0 only. No persona label, persona configuration,
ground truth or user id is ever used.
"""
from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass

import numpy as np
import pandas as pd

from core.cash_on_hand import cash_time_constant_days, estimate_cash_v2
from core.recurring import Stream, detect_streams, income_timing
from ml.features import advance_timing

INFLOW_TYPES = ("salary_in", "remittance_in", "cash_in")
TAUS = np.round(np.arange(0.1, 0.91, 0.1), 2)
MIN_HISTORY_DAYS = 30
MIN_TRAIN_HISTORY_DAYS = 90   # streams need ~3 occurrences before flows are split reliably

FEATURES = [
    # origin state (scale-free)
    "log_scale", "lifetime_days",
    "irr_net_7", "irr_net_30", "irr_net_90", "irr_net_std_30",
    "irr_out_7", "irr_out_30", "irr_in_7", "irr_in_30", "no_income_share_30",
    "irr_out_last1", "irr_out_last2", "irr_out_last3",
    "cashout_7", "days_since_cashout", "cash_est", "cash_tc_days",
    "balance_scaled", "balance_days_cover", "inflow_cv_90",
    "income_period_days",
    # target day
    "k", "dow", "dom", "is_month_end", "is_festival",
    "days_since_income", "days_to_income", "dom_irr_profile",
]


def event_key(ttype: str, counterparty_id: str, amount: int) -> str:
    """Stream key. Cash-outs share agents across purposes, so their key also
    carries a ~25%-wide amount bucket (e.g. rent paid in cash vs pocket money)."""
    if ttype == "cash_out":
        return f"{ttype}|{counterparty_id}|{int(round(math.log(max(amount, 1)) / math.log(1.25)))}"
    return f"{ttype}|{counterparty_id}"


@dataclass
class UserPanel:
    """Daily arrays for one user (index 0 = first day with a transaction)."""
    user_id: str
    dates: list[dt.date]
    irr_in: np.ndarray
    irr_out: np.ndarray
    sched_net: np.ndarray
    out_total: np.ndarray
    cashout: np.ndarray          # irregular (non-stream) cash-outs, paisa
    eod_balance: np.ndarray
    events: list[tuple[dt.date, str, int, int]]
    inflow_dates: list[dt.date]
    inflow_amounts: list[int]
    cashout_events: list[tuple[dt.date, str, int]]

    @property
    def irr_net(self) -> np.ndarray:
        return self.irr_in - self.irr_out

    def index_of(self, d: dt.date) -> int:
        return (d - self.dates[0]).days

    def streams_at(self, d0: dt.date) -> list[Stream]:
        """Recurring streams known at the end of day d0."""
        return detect_streams(self.events, d0 + dt.timedelta(days=1))


def build_panel(user_id: str, user_tx: pd.DataFrame, end: dt.date) -> UserPanel:
    """user_tx: one user's transactions (ts, type, amount_paisa, fee_paisa,
    counterparty_id, balance_after_paisa), any order."""
    t = user_tx.sort_values("ts")
    dates_tx = list(pd.to_datetime(t["ts"], utc=True).dt.tz_convert("Asia/Dhaka").dt.date)
    start = dates_tx[0]
    n = (end - start).days + 1
    dates = [start + dt.timedelta(days=i) for i in range(n)]

    types = t["type"].to_numpy()
    amounts = t["amount_paisa"].to_numpy(dtype=np.int64)
    fees = t["fee_paisa"].to_numpy(dtype=np.int64)
    cps = t["counterparty_id"].to_numpy()
    bal_after = t["balance_after_paisa"].to_numpy(dtype=np.int64)
    is_in = np.isin(types, INFLOW_TYPES)
    signed = np.where(is_in, amounts, -(amounts + fees))
    keys = [event_key(ty, cp, int(a)) for ty, cp, a in zip(types, cps, amounts)]
    events = [(d, k, 1 if i else -1, int(abs(s))) for d, k, i, s in zip(dates_tx, keys, is_in, signed)]

    # Scheduled flag: the transaction's key is a stream detected from data
    # before the start of its month (leakage-safe, recomputed monthly).
    month_streams: dict[tuple[int, int], set[str]] = {}
    sched = np.zeros(len(t), dtype=bool)
    for j, d in enumerate(dates_tx):
        mk = (d.year, d.month)
        if mk not in month_streams:
            month_streams[mk] = {s.key for s in detect_streams(events, dt.date(d.year, d.month, 1))}
        sched[j] = keys[j] in month_streams[mk]

    idx = np.array([(d - start).days for d in dates_tx], dtype=np.int64)
    irr_in = np.bincount(idx, weights=np.where(is_in & ~sched, amounts, 0), minlength=n).astype(float)
    irr_out = np.bincount(idx, weights=np.where(~is_in & ~sched, amounts + fees, 0), minlength=n).astype(float)
    sched_net = np.bincount(idx, weights=np.where(sched, signed, 0), minlength=n).astype(float)
    out_total = np.bincount(idx, weights=np.where(~is_in, amounts + fees, 0), minlength=n).astype(float)
    is_co = (types == "cash_out") & ~sched
    cashout = np.bincount(idx, weights=np.where(is_co, amounts, 0), minlength=n).astype(float)
    eod = np.full(n, np.nan)
    eod[idx] = bal_after            # last transaction of the day wins (sorted)
    eod = pd.Series(eod).ffill().to_numpy()

    return UserPanel(
        user_id=user_id, dates=dates, irr_in=irr_in, irr_out=irr_out, sched_net=sched_net,
        out_total=out_total, cashout=cashout, eod_balance=eod, events=events,
        inflow_dates=[d for d, i in zip(dates_tx, is_in) if i],
        inflow_amounts=[int(a) for a, i in zip(amounts, is_in) if i],
        cashout_events=[(d, k, int(a)) for d, k, a, c in zip(dates_tx, keys, amounts, types == "cash_out") if c],
    )


def _wmean(c: np.ndarray, i: int, w: int) -> float:
    """Mean over days (i-w, i] from a zero-prefixed cumsum `c`."""
    lo = max(i + 1 - w, 0)
    return float((c[i + 1] - c[lo]) / max(i + 1 - lo, 1))


class OriginFeatures:
    """Feature builder over one panel with prefix sums (fast many-origin use)."""

    def __init__(self, p: UserPanel, festival_days: set[str]):
        self.p = p
        self.festival = festival_days
        net = p.irr_net
        self.c_net = np.concatenate([[0.0], np.cumsum(net)])
        self.c_net2 = np.concatenate([[0.0], np.cumsum(net ** 2)])
        self.c_in = np.concatenate([[0.0], np.cumsum(p.irr_in)])
        self.c_out = np.concatenate([[0.0], np.cumsum(p.irr_out)])
        self.c_gross = np.concatenate([[0.0], np.cumsum(p.irr_in + p.irr_out)])
        self.c_noinc = np.concatenate([[0.0], np.cumsum((p.irr_in + 0) == 0)])
        self.c_co = np.concatenate([[0.0], np.cumsum(p.cashout)])
        self.dom = np.array([d.day for d in p.dates])

    def scale(self, i: int) -> float:
        return max(_wmean(self.c_gross, i, 90), 1_000.0)

    def floor(self, i: int, floor_days: int) -> float:
        """Personal shortfall floor: floor_days x median active-day outflow (90 d)."""
        w = self.p.out_total[max(i - 89, 0): i + 1]
        w = w[w > 0]
        return float(floor_days * np.median(w)) if w.size else 0.0

    def origin_state(self, i: int, streams: list[Stream] | None = None) -> dict[str, float]:
        p = self.p
        d0 = p.dates[i]
        s = self.scale(i)
        f: dict[str, float] = {"log_scale": math.log10(s), "lifetime_days": float(min(i + 1, 365))}
        for w in (7, 30, 90):
            f[f"irr_net_{w}"] = _wmean(self.c_net, i, w) / s
        m30 = _wmean(self.c_net, i, 30)
        f["irr_net_std_30"] = math.sqrt(max(_wmean(self.c_net2, i, 30) - m30 ** 2, 0.0)) / s
        for w in (7, 30):
            f[f"irr_out_{w}"] = _wmean(self.c_out, i, w) / s
            f[f"irr_in_{w}"] = _wmean(self.c_in, i, w) / s
        f["no_income_share_30"] = _wmean(self.c_noinc, i, 30)
        for lag in (1, 2, 3):
            f[f"irr_out_last{lag}"] = (p.irr_out[i + 1 - lag] / s) if i + 1 - lag >= 0 else 0.0
        f["cashout_7"] = _wmean(self.c_co, i, 7) * 7 / s
        co_idx = np.nonzero(p.cashout[: i + 1] > 0)[0]
        f["days_since_cashout"] = float(min(i - co_idx[-1], 30)) if co_idx.size else 30.0
        f["cash_est"], f["cash_tc_days"] = self.cash_estimate(i, streams)
        f["cash_est"] /= s
        bal = p.eod_balance[i]
        f["balance_scaled"] = (0.0 if np.isnan(bal) else bal) / s
        w = p.out_total[max(i - 89, 0): i + 1]
        med_out = float(np.median(w[w > 0])) if (w > 0).any() else 1.0
        f["balance_days_cover"] = min((0.0 if np.isnan(bal) else bal) / max(med_out, 1.0), 60.0)
        monthly_in = [p.irr_in[max(i - 29 - 30 * j, 0): i + 1 - 30 * j].sum() + 0.0 for j in range(3)
                      if i + 1 - 30 * j > 0]
        all_in = [x for x in monthly_in]
        f["inflow_cv_90"] = float(np.std(all_in) / np.mean(all_in)) if all_in and np.mean(all_in) > 0 else 0.0
        timing = income_timing(p.inflow_dates, p.inflow_amounts, d0 + dt.timedelta(days=1))
        f["income_period_days"] = float(timing.period_days)
        f["_timing"] = timing  # type: ignore[assignment]
        # Day-of-month profile of the scaled irregular net (days <= d0).
        dom_sum = np.bincount(self.dom[: i + 1], weights=p.irr_net[: i + 1], minlength=32)
        dom_cnt = np.bincount(self.dom[: i + 1], minlength=32)
        f["_dom_profile"] = np.where(dom_cnt > 0, dom_sum / np.maximum(dom_cnt, 1), 0.0) / s  # type: ignore[assignment]
        return f

    def cash_estimate(self, i: int, streams: list[Stream] | None = None) -> tuple[float, float]:
        """Cash-on-hand v2 at the end of day i (paisa) and the user's cash
        time constant. Cash-outs that belong to a recurring stream (e.g. rent
        paid in cash) are spent on the spot and excluded."""
        d0 = self.p.dates[i]
        stream_keys = {s.key for s in (streams if streams is not None else self.p.streams_at(d0))}
        cos = [(d, a) for d, k, a in self.p.cashout_events if d <= d0 and k not in stream_keys]
        if not cos:
            return 0.0, 7.0
        tc = cash_time_constant_days([d for d, _ in cos])
        return float(estimate_cash_v2([d for d, _ in cos], [a for _, a in cos], d0, tc)), tc

    def target_rows(self, state: dict, d0: dt.date, ks) -> list[dict[str, float]]:
        timing = state["_timing"]
        prof = state["_dom_profile"]
        rows = []
        for k in ks:
            d = d0 + dt.timedelta(days=int(k))
            since, to_next = advance_timing(timing, int(k) - 1)
            r = {c: v for c, v in state.items() if not c.startswith("_")}
            r.update(k=float(k), dow=float(d.weekday()), dom=float(d.day),
                     is_month_end=1.0 if d.day >= 25 else 0.0,
                     is_festival=1.0 if d.isoformat() in self.festival else 0.0,
                     days_since_income=float(since), days_to_income=float(to_next),
                     dom_irr_profile=float(prof[d.day]))
            rows.append(r)
        return rows


def festival_window(cfg) -> set[str]:
    cal = cfg.section("calendar")
    lead = int(cal.get("festival_lead_days", 0))
    out = set()
    for fd in cal["festival_days"]:
        base = dt.date.fromisoformat(fd)
        for j in range(-lead, 1):
            out.add((base + dt.timedelta(days=j)).isoformat())
    return out


def load_panels(tx: pd.DataFrame, user_ids, end: dt.date) -> dict[str, UserPanel]:
    sub = tx[tx["user_id"].isin(set(user_ids))]
    return {u: build_panel(u, g, end) for u, g in sub.groupby("user_id")}


def training_rows(panels: dict[str, UserPanel], festival: set[str], last_target: dt.date,
                  horizon: int, origin_every: int, ks_per_origin: int, seed: int,
                  first_origin: dt.date | None = None) -> pd.DataFrame:
    """Direct multi-horizon rows: (origin, k) pairs with the target
    irr_net(d0+k) / scale(d0). Only targets dated <= last_target are used."""
    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    for u, p in sorted(panels.items()):
        fb = OriginFeatures(p, festival)
        for i in range(MIN_TRAIN_HISTORY_DAYS, len(p.dates), origin_every):
            d0 = p.dates[i]
            if first_origin is not None and d0 < first_origin:
                continue
            max_k = min(horizon, (last_target - d0).days)
            if max_k < 1:
                break
            ks = np.sort(rng.choice(np.arange(1, max_k + 1), size=min(ks_per_origin, max_k), replace=False))
            state = fb.origin_state(i)
            s = fb.scale(i)
            for r, k in zip(fb.target_rows(state, d0, ks), ks):
                r.update(user_id=u, origin=d0, target=float(p.irr_net[i + k] / s), scale=s)
                rows.append(r)
    return pd.DataFrame(rows)
