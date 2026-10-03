"""`python -m data_gen.generate` — build the seeded synthetic dataset.

Writes data/{users,counterparties,transactions,user_goals}.parquet,
data/ground_truth.json, data/cash_truth.parquet (hidden cash pocket, for
evaluation only) and data/dataset_meta.json (seed + hash). A drifted test
cohort (shifted parameters, never trained on) is written to data/drifted/.

Insufficient-balance rule (documented ASSUMPTION): inflows are applied first
each day; an outflow that exceeds the wallet balance is skipped (paid late or
in cash — invisible to the wallet, which is exactly the partial-visibility
story). Balances therefore never go negative and month-end squeezes emerge
naturally from timing and volatility.
"""
from __future__ import annotations

import copy
import datetime as dt
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

from core.money import apply_rate
from core.schemas import TxnType
from core.timeutils import DHAKA
from data_gen.counterparties import Counterparty, build_counterparties
from sathi_config import load_config

DATA_DIR = Path(__file__).parent.parent / "data"
INFLOWS = (TxnType.SALARY_IN.value, TxnType.REMITTANCE_IN.value, TxnType.CASH_IN.value)


def _to_utc(d: dt.date, hour: int, minute: int) -> pd.Timestamp:
    return pd.Timestamp(dt.datetime(d.year, d.month, d.day, hour, minute, tzinfo=DHAKA)).tz_convert("UTC")


def drift_persona(p: dict, drift: dict) -> dict:
    """Shifted copy of a persona for the drifted test cohort."""
    q = copy.deepcopy(p)
    for s in q["income_streams"]:
        if "day_of_month" in s:
            s["day_of_month"] = min(s["day_of_month"] + int(drift["income_day_shift"]), 28)
        if "overtime" in s:
            s["overtime"]["std_paisa"] = int(s["overtime"]["std_paisa"] * drift["volatility_mult"])
        if "daily_std_frac" in s:
            s["daily_std_frac"] = s["daily_std_frac"] * drift["volatility_mult"]
        if "interval_jitter" in s:
            s["interval_jitter"] = int(s["interval_jitter"] * drift["volatility_mult"])
    q["shock"]["rate_per_month"] = q["shock"]["rate_per_month"] * drift["shock_mult"]
    return q


class _UserSim:
    """One user's month-by-month wallet life."""

    def __init__(self, user_id: str, persona_key: str, p: dict, rng: np.random.Generator,
                 start: dt.date, end: dt.date, fees: dict, festival_mult: dict[str, float],
                 eid_days: list[dt.date]):
        self.user_id = user_id
        self.persona_key = persona_key
        self.p = p
        self.rng = rng
        self.start = start
        self.end = end
        self.cash_out_bps = int(fees["cash_out_bps"])
        self.cash_out_min = int(fees["cash_out_min_paisa"])
        self.festival_mult = festival_mult
        self.eid_days = eid_days
        self.rows: list[dict] = []
        self.ground_truth_replaceable: list[str] = []
        self.ground_truth_shocks: list[str] = []
        self.cash_paid_obligations: set[str] = set()   # cash-outs spent at once (rent in cash)
        self.balance = int(p["start_balance_paisa"])
        self._txn_seq = 0
        self.habitual_agent = f"agent_{int(rng.integers(0, 40)):03d}"
        lo, hi = p["cash"]["spend_days"]
        self.cash_spend_days = float(rng.uniform(lo, hi))   # pocket time constant (hidden)

    def _emit(self, d: dt.date, hour: int, ttype: TxnType, amount: int, fee: int,
              cp: Counterparty, channel: str = "app", partial: bool = False) -> str | None:
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
            "partial": partial,
        })
        return tid

    def _lognormal(self, mean: float, sigma: float) -> int:
        return int(self.rng.lognormal(math.log(mean) - sigma ** 2 / 2, sigma))

    # ---- event builders -------------------------------------------------
    def salary_like(self, d: dt.date, stream: dict, cps: dict[str, list[Counterparty]],
                    state: dict) -> None:
        key = (d.year, d.month)
        if key not in state:
            # Decide this month's pay day once (jitter + occasional late wage).
            jitter = int(self.rng.integers(-stream.get("day_jitter", 0), stream.get("day_jitter", 0) + 1))
            day = min(max(stream["day_of_month"] + jitter, 1), 28)
            if self.rng.random() < stream.get("late_prob", 0.0):
                day = min(day + stream.get("late_days", 5), 28)
            skipped = self.rng.random() < stream.get("skip_prob", 0.0)
            state[key] = None if skipped else day
        if state[key] != d.day:
            return
        frac = stream.get("amount_jitter_frac", 0.0)
        amount = int(stream["amount_paisa"] * (1 + self.rng.uniform(-frac, frac)))
        ot = stream.get("overtime")
        if ot:
            amount += max(0, int(self.rng.normal(ot["mean_paisa"], ot["std_paisa"])))
        cp = cps["employer"] if stream["type"] == "salary_in" else cps["remit"]
        self._emit(d, 10, TxnType(stream["type"]), amount, 0, cp[0])

    def eid_bonus(self, d: dt.date, stream: dict, cps) -> None:
        bonus = stream.get("eid_bonus_frac")
        if not bonus or (d + dt.timedelta(days=7)) not in self.eid_days:
            return
        amount = int(stream["basic_paisa"] * self.rng.uniform(bonus[0], bonus[1]))
        self._emit(d, 10, TxnType.SALARY_IN, amount, 0, cps["employer"][0])

    def interval_income(self, d: dt.date, stream: dict, state: dict, cps) -> None:
        if state.get("next") is None:
            state["next"] = self.start + dt.timedelta(days=int(self.rng.integers(0, 6)))
        if d < state["next"]:
            return
        amount = int(stream["amount_paisa"] * (1 + self.rng.uniform(-stream["amount_jitter_frac"], stream["amount_jitter_frac"])))
        self._emit(d, 11, TxnType.REMITTANCE_IN, amount, 0, cps["remit"][0])
        state["next"] = d + dt.timedelta(days=max(stream["interval_days"] + int(self.rng.integers(-stream["interval_jitter"], stream["interval_jitter"] + 1)), 7))

    def daily_income(self, d: dt.date, stream: dict, cps) -> None:
        if self.rng.random() > stream.get("workday_prob", 1.0):
            return
        mean = stream["daily_mean_paisa"]
        amount = max(5_000, int(self.rng.normal(mean, mean * stream.get("daily_std_frac", 0.3))))
        ttype = TxnType(stream["type"])  # cash_in only; 'payment' is an outflow in the contract
        cp = self.rng.choice(cps["persons"])
        self._emit(d, 19, ttype, amount, 0, cp)

    def obligation(self, d: dt.date, ob: dict, cps, state: dict) -> None:
        if "every_days" in ob:
            if (d - self.start).days % ob["every_days"] != 0:
                return
        else:
            # Due day drawn once per month (a fresh draw every day would pay
            # the same rent 0-3 times a month).
            key = (d.year, d.month)
            if key not in state:
                jitter = int(self.rng.integers(-ob.get("jitter", 0), ob.get("jitter", 0) + 1))
                state[key] = min(max(ob["day"] + jitter, 1), 28)
            if d.day != state[key]:
                return
        if ob["type"] == TxnType.CASH_OUT.value:
            # Obligation paid in cash (e.g. rent to a landlord who takes cash):
            # withdraw at an agent, hand over the same day.
            agent = Counterparty(self.habitual_agent, "agent", "agent", False)
            fee = apply_rate(ob["amount_paisa"], self.cash_out_bps, self.cash_out_min)
            tid = self._emit(d, 9, TxnType.CASH_OUT, ob["amount_paisa"], fee, agent, channel="agent")
            if tid:
                self.cash_paid_obligations.add(tid)
            return
        cat = ob["category"]
        cp = {"rent": cps["landlord"], "utilities": cps["biller"], "mobile": cps["operator"],
              "business": cps["supplier"]}.get(cat, self.rng.choice(cps["persons"]))
        if isinstance(cp, list):
            cp = cp[0]
        amount = ob["amount_paisa"]
        if ob.get("partial") and amount > self.balance:
            # Must-pay obligations (supplier credit) are paid down as far as
            # the wallet allows instead of being skipped.
            amount = self.balance
            if amount < 10_000:
                return
        self._emit(d, 12, TxnType(ob["type"]), amount, 0, cp, partial=bool(ob.get("partial")))

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
        # Behavioural response: people cut discretionary spend when the
        # wallet runs low (otherwise the model would learn a fake world).
        low = ds.get("low_balance")
        if low and self.balance < low["below_days"] * ds["mean_paisa"]:
            amount = int(amount * low["factor"])
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
        tid = self._emit(d, int(co.get("hour", 16)), TxnType.CASH_OUT, amount, fee, cp, channel="agent")
        if tid is None:
            return
        # Injected pattern (kept for the cash-out audit journey): some
        # withdrawals are followed by a payment at a digital-accepting
        # merchant — the cash could have stayed digital.
        if self.rng.random() < co["digital_follow_prob"]:
            follow = min(d + dt.timedelta(days=int(self.rng.integers(1, 3))), self.end)
            pay_amount = int(amount * self.rng.uniform(0.5, 0.95))
            pool = cps["merch_digital"]
            self._emit(follow, 18, TxnType.PAYMENT, pay_amount, 0, pool[int(self.rng.integers(0, len(pool)))])
            self.ground_truth_replaceable.append(tid)

    def shock(self, d: dt.date, cps) -> None:
        sh = self.p["shock"]
        amount = max(10_000, self._lognormal(sh["mean_paisa"], sh["sigma"]))
        pool = cps["merch_other"]
        tid = self._emit(d, 15, TxnType.PAYMENT, amount, 0, pool[int(self.rng.integers(0, len(pool)))])
        if tid:
            self.ground_truth_shocks.append(tid)

    def cash_pocket(self, kept: list[dict]) -> list[tuple[str, dt.date, int]]:
        """Hidden ground truth: end-of-day physical cash. Cash-outs fill the
        pocket; it is spent at a user-specific exponential rate. Cash-outs
        that paid an obligation on the spot never stay in the pocket."""
        add: dict[dt.date, int] = {}
        for r in kept:
            if r["type"] == TxnType.CASH_OUT.value and r["txn_id"] not in self.cash_paid_obligations:
                d = r["ts"].tz_convert("Asia/Dhaka").date()
                add[d] = add.get(d, 0) + int(r["amount_paisa"])
        keep_share = 1.0 - 1.0 / self.cash_spend_days
        pocket, out, d = 0.0, [], self.start
        while d <= self.end:
            pocket = pocket * keep_share + add.get(d, 0)
            out.append((self.user_id, d, int(pocket)))
            d += dt.timedelta(days=1)
        return out


def _simulate_cohort(prefix: str, n_users: int, persona_keys: list[str], personas: dict,
                     rng: np.random.Generator, window_start: dt.date, as_of: dt.date,
                     fees: dict, festival_mult: dict, eid_days: list[dt.date], cps: dict):
    users_rows, all_txn_rows, cash_rows = [], [], []
    gt_replaceable, gt_shocks = [], []
    for i in range(n_users):
        user_id = f"{prefix}{i + 1:04d}"
        persona_key = persona_keys[i % len(persona_keys)]    # balanced personas
        p = personas[persona_key]
        months = int(rng.integers(p["history_months"][0], p["history_months"][1] + 1))
        start = max(window_start, as_of - dt.timedelta(days=int(months * 30.4375)))
        sim = _UserSim(user_id, persona_key, p, rng, start, as_of, fees, festival_mult, eid_days)

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
        remit_state: dict = {}
        salary_state: list[dict] = [{} for _ in p["income_streams"]]
        obligation_state: list[dict] = [{} for _ in p["obligations"]]
        shock_p = p["shock"]["rate_per_month"] / 30.4375
        d = start
        while d <= as_of:
            for stream, st in zip(p["income_streams"], salary_state):
                if "daily_mean_paisa" in stream:
                    sim.daily_income(d, stream, cps)
                elif "interval_days" in stream:
                    sim.interval_income(d, stream, remit_state, cps)
                else:
                    sim.salary_like(d, stream, cps, st)
                    sim.eid_bonus(d, stream, cps)
            for ob, st in zip(p["obligations"], obligation_state):
                sim.obligation(d, ob, cps, st)
            if d in cashout_plan:
                sim.cashout_today(d, cashout_plan[d], cps)
            sim.daily_spend(d, cps)
            if rng.random() < shock_p:
                sim.shock(d, cps)
            d += dt.timedelta(days=1)

        # Sort this user's events by time and rebuild the running balance so
        # the emitted order matches balance_after_paisa.
        sim.rows.sort(key=lambda r: r["ts"])
        bal = int(p["start_balance_paisa"])
        kept: list[dict] = []
        for row in sim.rows:
            if row["type"] in INFLOWS:
                bal += row["amount_paisa"]
            else:
                total = row["amount_paisa"] + row["fee_paisa"]
                if total > bal and row.get("partial") and bal >= 10_000:
                    row["amount_paisa"] = total = bal   # partial payment in the re-sorted order
                if total > bal:
                    continue  # skipped outflow: paid late or in cash
                bal -= total
            row["balance_after_paisa"] = bal
            kept.append(row)
        kept_ids = {r["txn_id"] for r in kept}
        gt_replaceable.extend(t for t in sim.ground_truth_replaceable if t in kept_ids)
        gt_shocks.extend(t for t in sim.ground_truth_shocks if t in kept_ids)
        for row in kept:
            row.pop("partial", None)
        all_txn_rows.extend(kept)
        cash_rows.extend(sim.cash_pocket(kept))
        users_rows.append({
            "user_id": user_id, "persona": persona_key,
            "age_band": p["age_band"], "region": p["region"],
            "income_band": p["income_band"],
            "created_at": _to_utc(start, 9, 0),
        })
    return users_rows, all_txn_rows, cash_rows, gt_replaceable, gt_shocks


def transactions_hash(txns_df: pd.DataFrame) -> str:
    return hashlib.sha256(pd.util.hash_pandas_object(txns_df.drop(columns=["ts"]), index=False).values.tobytes()).hexdigest()


def generate(n_users: int | None = None, n_drifted_per_persona: int | None = None,
             out_dir: Path = DATA_DIR) -> dict:
    cfg = load_config()
    ds = cfg.section("dataset")
    fees = cfg.section("fees")
    personas = cfg.section("personas")
    cal = cfg.section("calendar")

    seed = int(ds["seed"])
    rng = np.random.default_rng(seed)
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    window_start = dt.date.fromisoformat(ds["start_date"])
    n_users = int(ds["n_users"]) if n_users is None else n_users
    drift_cfg = ds["drifted_cohort"]
    n_drift = int(drift_cfg["users_per_persona"]) if n_drifted_per_persona is None else n_drifted_per_persona

    festival_mult: dict[str, float] = {}
    lead = int(cal.get("festival_lead_days", 0))
    for fd in cal["festival_days"]:
        base = dt.date.fromisoformat(fd)
        for k in range(-lead, 1):
            festival_mult[(base + dt.timedelta(days=k)).isoformat()] = float(cal["festival_spend_multiplier"])
    eid_days = [dt.date.fromisoformat(e) for e in cal["eid_days"]]

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

    users_rows, txn_rows, cash_rows, gt_replaceable, gt_shocks = _simulate_cohort(
        "u", n_users, persona_keys, personas, rng, window_start, as_of, fees,
        festival_mult, eid_days, cps)

    out_dir.mkdir(parents=True, exist_ok=True)
    users_df = pd.DataFrame(users_rows)
    txns_df = pd.DataFrame(txn_rows)
    cps_df = pd.DataFrame([c.__dict__ for c in all_cps])
    goals_df = pd.DataFrame(columns=["goal_id", "user_id", "goal_type",
                                     "target_amount_paisa", "deadline", "created_at"])
    cash_df = pd.DataFrame(cash_rows, columns=["user_id", "date", "cash_paisa"])

    users_df.to_parquet(out_dir / "users.parquet", index=False)
    txns_df.to_parquet(out_dir / "transactions.parquet", index=False)
    cps_df.to_parquet(out_dir / "counterparties.parquet", index=False)
    goals_df.to_parquet(out_dir / "user_goals.parquet", index=False)
    cash_df.to_parquet(out_dir / "cash_truth.parquet", index=False)

    # Drifted cohort: same world, shifted parameters (income day, volatility,
    # shocks). A second test set that no model ever trains or tunes on.
    drifted = {k: drift_persona(v, drift_cfg) for k, v in personas.items()}
    d_rng = np.random.default_rng(seed + 1)
    d_users, d_txns, d_cash, _, _ = _simulate_cohort(
        "d", n_drift * len(persona_keys), persona_keys, drifted, d_rng, window_start, as_of,
        fees, festival_mult, eid_days, cps)
    d_dir = out_dir / "drifted"
    d_dir.mkdir(exist_ok=True)
    pd.DataFrame(d_users).to_parquet(d_dir / "users.parquet", index=False)
    pd.DataFrame(d_txns).to_parquet(d_dir / "transactions.parquet", index=False)
    pd.DataFrame(d_cash, columns=["user_id", "date", "cash_paisa"]).to_parquet(
        d_dir / "cash_truth.parquet", index=False)

    payload = {
        "seed": seed,
        "as_of_date": ds["as_of_date"],
        "n_users": len(users_df),
        "n_transactions": len(txns_df),
        "n_drifted_users": len(d_users),
        "injected_patterns": [
            "salary (base + overtime, occasionally late) and rent/bill clusters on fixed days",
            "Eid bonuses paid a week before Eid",
            "rent paid in cash via same-day cash-out (garment worker)",
            "festival spending spikes",
            "month-end squeeze via front-loaded spending",
            "discretionary spend cut when the wallet runs low",
            "Poisson shocks with lognormal amounts",
            "hidden cash pocket spent at a user-specific rate (cash_truth.parquet)",
            "repeat small cash-outs to the same agent followed by digital-capable merchant payments",
        ],
    }
    payload["transactions_hash"] = transactions_hash(txns_df)
    (out_dir / "dataset_meta.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    (out_dir / "ground_truth.json").write_text(json.dumps({
        "replaceable_cashout_txn_ids": sorted(gt_replaceable),
        "shock_txn_ids": sorted(gt_shocks),
    }), encoding="utf-8")
    print(f"users={len(users_df)} txns={len(txns_df)} drifted_users={len(d_users)} "
          f"replaceable={len(gt_replaceable)} shocks={len(gt_shocks)}")
    return payload


if __name__ == "__main__":
    generate()
