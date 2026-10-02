"""`python -m data_gen.generate` — build the seeded synthetic dataset.

Writes data/{users,counterparties,transactions,user_goals}.parquet,
data/ground_truth.json and data/dataset_meta.json (seed + hash).

Insufficient-balance rule (documented ASSUMPTION): inflows are applied first
each day; an outflow that exceeds the wallet balance is skipped (paid late or
in cash — invisible to the wallet, which is exactly the partial-visibility
story). Balances therefore never go negative and month-end squeezes emerge
naturally from timing.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

from core.money import apply_rate
from core.schemas import TxnType
from core.timeutils import DHAKA
from data_gen.counterparties import Counterparty, build_counterparties
from sathi_config import load_config

DATA_DIR = Path(__file__).parent.parent / "data"


def _to_utc(d: dt.date, hour: int, minute: int) -> pd.Timestamp:
    return pd.Timestamp(dt.datetime(d.year, d.month, d.day, hour, minute, tzinfo=DHAKA)).tz_convert("UTC")


class _UserSim:
    """One user's month-by-month wallet life."""

    def __init__(self, user_id: str, persona_key: str, p: dict, rng: np.random.Generator,
                 start: dt.date, end: dt.date, fees: dict, festival_mult: dict[str, float]):
        self.user_id = user_id
        self.persona_key = persona_key
        self.p = p
        self.rng = rng
        self.start = start
        self.end = end
        self.cash_out_bps = int(fees["cash_out_bps"])
        self.cash_out_min = int(fees["cash_out_min_paisa"])
        self.festival_mult = festival_mult
        self.rows: list[dict] = []
        self.ground_truth_replaceable: list[str] = []
        self.ground_truth_shocks: list[str] = []
        self.balance = int(p["start_balance_paisa"])
        self._txn_seq = 0
        self.habitual_agent = f"agent_{int(rng.integers(0, 40)):03d}"

    def _emit(self, d: dt.date, hour: int, ttype: TxnType, amount: int, fee: int,
              cp: Counterparty, channel: str = "app") -> str | None:
        is_inflow = ttype in (TxnType.SALARY_IN, TxnType.REMITTANCE_IN, TxnType.CASH_IN)
        if not is_inflow:
            if amount + fee > self.balance:
                return None  # skipped: paid late or in cash, invisible to the wallet
            self.balance -= amount + fee
        else:
            self.balance += amount
        self._txn_seq += 1
        tid = f"{self.user_id}_t{self._txn_seq:05d}"
        self.rows.append({
            "txn_id": tid,
            "user_id": self.user_id,
            "ts": _to_utc(d, hour, int(self.rng.integers(0, 60))),
            "type": ttype.value,
            "amount_paisa": int(amount),
            "fee_paisa": int(fee),
            "counterparty_id": cp.counterparty_id,
            "counterparty_type": cp.type,
            "counterparty_category": cp.category,
            "counterparty_accepts_digital": bool(cp.accepts_digital),
            "channel": channel,
            "balance_after_paisa": int(self.balance),
        })
        return tid

    # ---- event builders -------------------------------------------------
    def salary_like(self, d: dt.date, stream: dict, cps: dict[str, list[Counterparty]]) -> None:
        jitter = int(self.rng.integers(-stream.get("day_jitter", 0), stream.get("day_jitter", 0) + 1))
        day = min(max(stream["day_of_month"] + jitter, 1), 28)
        if self.rng.random() < stream.get("late_prob", 0.0):
            day = min(day + stream.get("late_days", 5), 28)
        if d.day != day:
            return
        amount = int(stream["amount_paisa"] * (1 + self.rng.uniform(-stream.get("amount_jitter_frac", 0), stream["amount_jitter_frac"] if stream.get("amount_jitter_frac") else 0)))
        cp = cps["employer"] if stream["type"] == "salary_in" else cps["remit"]
        self._emit(d, 10, TxnType(stream["type"]), amount, 0, cp[0])

    def interval_income(self, d: dt.date, stream: dict, state: dict, cps) -> None:
        if state.get("next") is None:
            state["next"] = self.start + dt.timedelta(days=int(self.rng.integers(0, 6)))
        if d < state["next"]:
            return
        amount = int(stream["amount_paisa"] * (1 + self.rng.uniform(-stream["amount_jitter_frac"], stream["amount_jitter_frac"])))
        self._emit(d, 11, TxnType.REMITTANCE_IN, amount, 0, cps["remit"][0])
        state["next"] = d + dt.timedelta(days=stream["interval_days"] + int(self.rng.integers(-stream["interval_jitter"], stream["interval_jitter"] + 1)))

    def daily_income(self, d: dt.date, stream: dict, cps) -> None:
        if self.rng.random() > stream.get("workday_prob", 1.0):
            return
        mean = stream["daily_mean_paisa"]
        amount = max(5_000, int(self.rng.normal(mean, mean * stream.get("daily_std_frac", 0.3))))
        ttype = TxnType(stream["type"])  # cash_in only; 'payment' is an outflow in the contract
        cp = self.rng.choice(cps["persons"])
        self._emit(d, 19, ttype, amount, 0, cp)

    def obligation(self, d: dt.date, ob: dict, cps) -> None:
        if "every_days" in ob:
            if (d - self.start).days % ob["every_days"] != 0:
                return
        else:
            jitter = int(self.rng.integers(-ob.get("jitter", 0), ob.get("jitter", 0) + 1))
            if d.day != min(max(ob["day"] + jitter, 1), 28):
                return
        cat = ob["category"]
        cp = {"rent": cps["landlord"], "utilities": cps["biller"], "mobile": cps["operator"],
              "business": cps["supplier"]}.get(cat, self.rng.choice(cps["persons"]))
        if isinstance(cp, list):
            cp = cp[0]
        self._emit(d, 12, TxnType(ob["type"]), ob["amount_paisa"], 0, cp)

    def daily_spend(self, d: dt.date, cps) -> None:
        ds = self.p["daily_spend"]
        if self.rng.random() < ds.get("skip_prob", 0.0):
            return
        amount = max(2_000, int(self.rng.normal(ds["mean_paisa"], ds["mean_paisa"] * ds["std_frac"])))
        fl = ds.get("frontload")
        if fl and fl["start_day"] <= d.day <= fl["end_day"]:
            n_in = fl["end_day"] - fl["start_day"] + 1
            n_out = max(30 - n_in, 1)
            factor = fl["share"] * n_out / ((1 - fl["share"]) * n_in)
            amount = int(amount * factor)
        amount = int(amount * self.festival_mult.get(d.isoformat(), 1.0))
        cats = ds["categories"]
        keys = sorted(cats)
        total_share = float(sum(cats.values()))
        cat = str(self.rng.choice(keys, p=[cats[k] / total_share for k in keys]))
        pool = cps[f"merch_{cat}"]
        cp = pool[int(self.rng.integers(0, len(pool)))]
        self._emit(d, 14, TxnType.PAYMENT, amount, 0, cp)

    def cashouts(self, days: list[dt.date]) -> dict[dt.date, int]:
        """Plan this month's cash-out days and amounts (seeded). Returns
        {date: amount}; the actual emission happens during the day walk,
        after that day's income, so the balance clamp behaves naturally."""
        co = self.p["cashout"]
        n = int(self.rng.integers(co["per_month"][0], co["per_month"][1] + 1))
        plan: dict[dt.date, int] = {}
        if not days:
            return plan
        for _ in range(n):
            d = days[int(self.rng.integers(0, len(days)))]
            plan[d] = plan.get(d, 0) + int(self.rng.integers(co["amount_paisa"][0], co["amount_paisa"][1] + 1))
        return plan

    def cashout_today(self, d: dt.date, amount: int, cps) -> None:
        co = self.p["cashout"]
        agent = self.habitual_agent if self.rng.random() < co["same_agent_prob"] else f"agent_{int(self.rng.integers(0, 40)):03d}"
        cp = Counterparty(agent, "agent", "agent", False)
        fee = apply_rate(amount, self.cash_out_bps, self.cash_out_min)
        tid = self._emit(d, 16, TxnType.CASH_OUT, amount, fee, cp, channel="agent")
        if tid is None:
            return
        # Injected pattern: some withdrawals are followed by a payment at a
        # digital-accepting merchant — the cash could have stayed digital.
        if self.rng.random() < co["digital_follow_prob"]:
            follow = min(d + dt.timedelta(days=int(self.rng.integers(1, 3))), self.end)
            pay_amount = int(amount * self.rng.uniform(0.5, 0.95))
            pool = cps["merch_digital"]
            self._emit(follow, 18, TxnType.PAYMENT, pay_amount, 0, pool[int(self.rng.integers(0, len(pool)))])
            self.ground_truth_replaceable.append(tid)

    def shock(self, d: dt.date, cps) -> None:
        sh = self.p["shock"]
        amount = int(self.rng.integers(sh["amount_paisa"][0], sh["amount_paisa"][1] + 1))
        pool = cps["merch_other"]
        tid = self._emit(d, 15, TxnType.PAYMENT, amount, 0, pool[int(self.rng.integers(0, len(pool)))])
        if tid:
            self.ground_truth_shocks.append(tid)


def generate() -> dict:
    cfg = load_config()
    ds = cfg.section("dataset")
    fees = cfg.section("fees")
    personas = cfg.section("personas")
    cal = cfg.section("calendar")

    seed = int(ds["seed"])
    rng = np.random.default_rng(seed)
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    window_start = dt.date.fromisoformat(ds["start_date"])
    n_users = int(ds["n_users"])

    festival_mult: dict[str, float] = {}
    lead = int(cal.get("festival_lead_days", 0))
    for fd in cal["festival_days"]:
        base = dt.date.fromisoformat(fd)
        for k in range(-lead, 1):
            festival_mult[(base + dt.timedelta(days=k)).isoformat()] = float(cal["festival_spend_multiplier"])

    # Counterparty pools by role.
    all_cps = build_counterparties()
    cps = {
        "employer": [c for c in all_cps if c.category == "employer"],
        "remit": [c for c in all_cps if c.category == "remittance"],
        "landlord": [c for c in all_cps if c.category == "rent"],
        "biller": [c for c in all_cps if c.type == "biller"],
        "operator": [c for c in all_cps if c.type == "operator"],
        "supplier": [c for c in all_cps if c.category == "business" and c.type == "person"],
        "persons": [c for c in all_cps if c.category == "family"],
        "merch_food": [c for c in all_cps if c.category == "food"],
        "merch_transport": [c for c in all_cps if c.category == "transport"],
        "merch_other": [c for c in all_cps if c.category == "other"],
        "merch_digital": [c for c in all_cps if c.type == "merchant" and c.accepts_digital],
    }

    persona_keys = sorted(personas.keys())
    weights = np.array([personas[k]["weight"] for k in persona_keys])
    weights = weights / weights.sum()

    users_rows, all_txn_rows = [], []
    gt_replaceable, gt_shocks = [], []
    interval_state: dict[str, dict] = {}

    for i in range(n_users):
        user_id = f"u{i + 1:04d}"
        persona_key = str(rng.choice(persona_keys, p=weights))
        p = personas[persona_key]
        months = int(rng.integers(p["history_months"][0], p["history_months"][1] + 1))
        start = max(window_start, as_of - dt.timedelta(days=int(months * 30.4375)))
        sim = _UserSim(user_id, persona_key, p, rng, start, as_of, fees, festival_mult)

        # Monthly cash-out planning is seeded up front; emission happens in
        # the day walk so income of the same day lands first.
        cashout_plan: dict[dt.date, int] = {}
        month_days: dict[tuple[int, int], list[dt.date]] = {}
        d = start
        while d <= as_of:
            month_days.setdefault((d.year, d.month), []).append(d)
            d += dt.timedelta(days=1)
        for key in sorted(month_days):
            for day, amount in sim.cashouts(month_days[key]).items():
                cashout_plan[day] = cashout_plan.get(day, 0) + amount

        # Walk every day: income first, then obligations, cash-outs, spend, shocks.
        remit_state = interval_state.setdefault(user_id, {})
        d = start
        while d <= as_of:
            for stream in p["income_streams"]:
                if "daily_mean_paisa" in stream:
                    sim.daily_income(d, stream, cps)
                elif "interval_days" in stream:
                    sim.interval_income(d, stream, remit_state, cps)
                else:
                    if rng.random() >= stream.get("skip_prob", 0.0):
                        sim.salary_like(d, stream, cps)
            for ob in p["obligations"]:
                sim.obligation(d, ob, cps)
            if d in cashout_plan:
                sim.cashout_today(d, cashout_plan[d], cps)
            sim.daily_spend(d, cps)
            if rng.random() < p["shock"]["prob_per_month"] / 30.4:
                sim.shock(d, cps)
            d += dt.timedelta(days=1)

        # Sort this user's events by time and rebuild the running balance so
        # the emitted order matches balance_after_paisa.
        sim.rows.sort(key=lambda r: r["ts"])
        bal = int(p["start_balance_paisa"])
        kept: list[dict] = []
        for row in sim.rows:
            if row["type"] in (TxnType.SALARY_IN.value, TxnType.REMITTANCE_IN.value, TxnType.CASH_IN.value):
                bal += row["amount_paisa"]
            else:
                total = row["amount_paisa"] + row["fee_paisa"]
                if total > bal:
                    continue  # skipped outflow: paid late or in cash
                bal -= total
            row["balance_after_paisa"] = bal
            kept.append(row)
        # Replaceable ground truth refers to kept cash-out ids only.
        kept_ids = {r["txn_id"] for r in kept}
        gt_replaceable.extend(t for t in sim.ground_truth_replaceable if t in kept_ids)
        gt_shocks.extend(t for t in sim.ground_truth_shocks if t in kept_ids)
        all_txn_rows.extend(kept)
        users_rows.append({
            "user_id": user_id, "persona": persona_key,
            "age_band": p["age_band"], "region": p["region"],
            "income_band": p["income_band"],
            "created_at": _to_utc(start, 9, 0),
        })

    DATA_DIR.mkdir(exist_ok=True)
    users_df = pd.DataFrame(users_rows)
    txns_df = pd.DataFrame(all_txn_rows)
    cps_df = pd.DataFrame([c.__dict__ for c in all_cps])
    goals_df = pd.DataFrame(columns=["goal_id", "user_id", "goal_type",
                                     "target_amount_paisa", "deadline", "created_at"])

    users_df.to_parquet(DATA_DIR / "users.parquet", index=False)
    txns_df.to_parquet(DATA_DIR / "transactions.parquet", index=False)
    cps_df.to_parquet(DATA_DIR / "counterparties.parquet", index=False)
    goals_df.to_parquet(DATA_DIR / "user_goals.parquet", index=False)

    payload = {
        "seed": seed,
        "as_of_date": ds["as_of_date"],
        "n_users": len(users_df),
        "n_transactions": len(txns_df),
        "injected_patterns": [
            "salary spikes and rent/bill clusters on fixed days",
            "festival spending spikes",
            "month-end squeeze via front-loaded spending",
            "repeat small cash-outs to the same agent followed by digital-capable merchant payments",
            "rare one-off shocks",
        ],
    }
    digest = hashlib.sha256(pd.util.hash_pandas_object(txns_df.drop(columns=["ts"]), index=False).values.tobytes()).hexdigest()
    payload["transactions_hash"] = digest
    (DATA_DIR / "dataset_meta.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    (DATA_DIR / "ground_truth.json").write_text(json.dumps({
        "replaceable_cashout_txn_ids": sorted(gt_replaceable),
        "shock_txn_ids": sorted(gt_shocks),
    }), encoding="utf-8")
    print(f"users={len(users_df)} txns={len(txns_df)} replaceable={len(gt_replaceable)} shocks={len(gt_shocks)}")
    return payload


if __name__ == "__main__":
    generate()
