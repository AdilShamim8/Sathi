"""Cash-on-hand estimation model. Pure function over transaction history.

In the Bangladesh MFS context, cashing out from an agent or ATM transitions
digital float into physical cash in hand. Modeling this remaining cash prevents
falsely predicting a liquidity crunch when the customer has cash in pocket.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from core.categorizer import categorize
from core.formatting import format_taka
from core.schemas import Category, Txn
from core.timeutils import dhaka_date


@dataclass(frozen=True)
class CashOnHandEstimate:
    estimated_cash_paisa: int
    estimated_cash_display: str
    trailing_cashout_total_paisa: int
    trailing_cashout_total_display: str
    daily_cash_burn_paisa: int
    daily_cash_burn_display: str
    days_of_cash_remaining: float
    confidence: str  # "normal" | "low"
    last_cashout_date: str | None


def estimate_cash_on_hand(
    txns: list[Txn],
    as_of_date: dt.date,
    decay_days: int = 7,
) -> CashOnHandEstimate:
    """Estimate physical cash held by user from recent cash-out withdrawals.

    Algorithm:
      1. Find all Cash-Out transactions in the trailing `decay_days` window.
      2. For each cash-out, model linear expenditure decay:
         A withdrawal made `k` days ago retains max(0, 1 - k / decay_days) of its value.
      3. Compute aggregate remaining physical cash.
    """
    if not txns:
        return CashOnHandEstimate(
            estimated_cash_paisa=0,
            estimated_cash_display="৳০",
            trailing_cashout_total_paisa=0,
            trailing_cashout_total_display="৳০",
            daily_cash_burn_paisa=0,
            daily_cash_burn_display="৳০",
            days_of_cash_remaining=0.0,
            confidence="low",
            last_cashout_date=None,
        )

    cutoff_date = as_of_date - dt.timedelta(days=decay_days)
    recent_cashouts: list[tuple[Txn, dt.date]] = []
    all_cashouts: list[tuple[Txn, dt.date]] = []

    for t in txns:
        if not t.is_inflow and categorize(t).category == Category.CASH_OUT:
            d = dhaka_date(t.ts)
            all_cashouts.append((t, d))
            if d >= cutoff_date:
                recent_cashouts.append((t, d))

    if not recent_cashouts:
        # No recent cashout
        last_d = all_cashouts[-1][1].isoformat() if all_cashouts else None
        return CashOnHandEstimate(
            estimated_cash_paisa=0,
            estimated_cash_display="৳০",
            trailing_cashout_total_paisa=0,
            trailing_cashout_total_display="৳০",
            daily_cash_burn_paisa=0,
            daily_cash_burn_display="৳০",
            days_of_cash_remaining=0.0,
            confidence="normal" if len(txns) >= 10 else "low",
            last_cashout_date=last_d,
        )

    total_withdrawn_paisa = sum(t.amount_paisa for t, _ in recent_cashouts)
    estimated_remaining_paisa = 0

    for t, d in recent_cashouts:
        days_elapsed = max(0, (as_of_date - d).days)
        if days_elapsed < decay_days:
            # Linear decay assumption: e.g. at day 0: 100%, day 3: 57%, day 7: 0%
            fraction_remaining = max(0.0, 1.0 - (days_elapsed / decay_days))
            estimated_remaining_paisa += int(t.amount_paisa * fraction_remaining)

    daily_burn_paisa = int(total_withdrawn_paisa / max(decay_days, 1))
    days_remaining = (
        estimated_remaining_paisa / daily_burn_paisa
        if daily_burn_paisa > 0
        else 0.0
    )

    last_date_iso = recent_cashouts[-1][1].isoformat()

    return CashOnHandEstimate(
        estimated_cash_paisa=estimated_remaining_paisa,
        estimated_cash_display=format_taka(estimated_remaining_paisa, "bn"),
        trailing_cashout_total_paisa=total_withdrawn_paisa,
        trailing_cashout_total_display=format_taka(total_withdrawn_paisa, "bn"),
        daily_cash_burn_paisa=daily_burn_paisa,
        daily_cash_burn_display=format_taka(daily_burn_paisa, "bn"),
        days_of_cash_remaining=round(days_remaining, 1),
        confidence="normal",
        last_cashout_date=last_date_iso,
    )


def cash_time_constant_days(cashout_dates: list[dt.date], lo: float = 2.0, hi: float = 10.0) -> float:
    """Per-user cash life (days), from the user's own cash-out cadence: if
    cash-outs come every ~g days, a withdrawal lasts ~g days. Pure."""
    days = sorted(set(cashout_dates))
    gaps = [(b - a).days for a, b in zip(days, days[1:])]
    if len(gaps) < 2:
        return 7.0
    return float(min(max(sorted(gaps)[len(gaps) // 2], lo), hi))


def estimate_cash_v2(cashout_dates: list[dt.date], cashout_amounts: list[int],
                     as_of_date: dt.date, time_constant_days: float) -> int:
    """v2 cash-on-hand: each withdrawal decays exponentially with the user's
    own time constant; cash-outs on or after `as_of_date`'s next day are
    ignored. Withdrawals that paid an obligation on the spot (e.g. rent in
    cash) should be excluded by the caller. Pure; paisa."""
    import math
    keep = 1.0 - 1.0 / max(time_constant_days, 1.0)
    total = 0.0
    for d, a in zip(cashout_dates, cashout_amounts):
        age = (as_of_date - d).days
        if age >= 0:
            total += a * math.pow(keep, age)
    return int(total)
