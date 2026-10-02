"""Metrics engine. Pure functions over categorized transactions.

Definitions (CONTEXT §10.6) — the engine computes these, the LLM never does:
  savings_rate           = (income - spending) / income
  income_volatility      = CV of monthly inflow (normalized per user)
  buffer_days            = liquid balance / average daily essential spend
  cash_dependency_ratio  = cash-out value / total outflow
  fee_leakage            = total fees / total spending
  fixed_commitment_ratio = recurring obligations / income
"""
from __future__ import annotations

import datetime as dt
import statistics
from dataclasses import dataclass

from core.categorizer import categorize
from core.schemas import ESSENTIAL_CATEGORIES, Category, Txn
from core.timeutils import dhaka_date

OBLIGATION_CATEGORIES = {Category.RENT, Category.BILLS, Category.MOBILE, Category.FAMILY, Category.BUSINESS}


@dataclass(frozen=True)
class MetricValue:
    """A raw value plus its label for the evidence block."""
    value: float          # ratios/probabilities in [0,1] or days; NaN-safe caller side
    label: str            # evidence label: always "Data" for metrics


@dataclass(frozen=True)
class MetricsBundle:
    monthly_income_paisa: int
    monthly_spend_paisa: int
    savings_rate: float | None          # None when income is zero
    income_volatility: float | None     # CV of monthly inflows
    buffer_days: float | None           # None when no essential spend seen
    cash_dependency_ratio: float | None
    fee_leakage: float | None
    fixed_commitment_ratio: float | None
    n_transactions: int
    window_days: int


def monthly_totals(txns: list[Txn]) -> dict[tuple[int, int], tuple[int, int]]:
    """(year, month) -> (inflow_paisa, outflow_paisa), Dhaka calendar."""
    totals: dict[tuple[int, int], list[int]] = {}
    for t in txns:
        d = dhaka_date(t.ts)
        key = (d.year, d.month)
        slot = totals.setdefault(key, [0, 0])
        if t.is_inflow:
            slot[0] += t.amount_paisa
        else:
            slot[1] += t.amount_paisa + t.fee_paisa
    return {k: (v[0], v[1]) for k, v in totals.items()}


def compute_metrics(
    txns: list[Txn],
    balance_paisa: int,
    as_of_date: dt.date,
    essentials_per_day_paisa: int,
) -> MetricsBundle:
    """All summary metrics for one user over the given transactions.

    Empty history returns zeros and Nones; the caller reports low confidence.
    """
    n = len(txns)
    if n == 0:
        return MetricsBundle(0, 0, None, None, None, None, None, None, 0, 0)

    dates = [dhaka_date(t.ts) for t in txns]
    window_days = max((max(dates) - min(dates)).days + 1, 1)
    months = max(window_days / 30.4375, 1e-9)

    inflow = sum(t.amount_paisa for t in txns if t.is_inflow)
    outflow = sum(t.amount_paisa + t.fee_paisa for t in txns if not t.is_inflow)
    fees = sum(t.fee_paisa for t in txns)
    cashout = sum(
        t.amount_paisa + t.fee_paisa
        for t in txns
        if categorize(t).category == Category.CASH_OUT
    )
    obligations = sum(
        t.amount_paisa
        for t in txns
        if not t.is_inflow and categorize(t).category in OBLIGATION_CATEGORIES
    )
    essential_spend = sum(
        t.amount_paisa
        for t in txns
        if not t.is_inflow and categorize(t).category in ESSENTIAL_CATEGORIES
    )

    savings_rate = (inflow - outflow) / inflow if inflow > 0 else None
    monthly_in = [v[0] for v in monthly_totals(txns).values()]
    income_volatility = (
        statistics.pstdev(monthly_in) / statistics.mean(monthly_in)
        if len(monthly_in) > 1 and statistics.mean(monthly_in) > 0
        else None
    )
    avg_daily_essential = essential_spend / window_days
    # Buffer uses the larger of observed essential spend and the configured
    # threshold so a low-activity user does not look falsely safe.
    divisor = max(avg_daily_essential, float(essentials_per_day_paisa))
    buffer_days = balance_paisa / divisor if divisor > 0 else None
    cash_dependency = cashout / outflow if outflow > 0 else None
    fee_leakage = fees / outflow if outflow > 0 else None
    monthly_income = int(inflow / months)
    fixed_ratio = (obligations / months) / monthly_income if monthly_income > 0 else None

    return MetricsBundle(
        monthly_income_paisa=monthly_income,
        monthly_spend_paisa=int(outflow / months),
        savings_rate=savings_rate,
        income_volatility=income_volatility,
        buffer_days=buffer_days,
        cash_dependency_ratio=cash_dependency,
        fee_leakage=fee_leakage,
        fixed_commitment_ratio=fixed_ratio,
        n_transactions=n,
        window_days=window_days,
    )


@dataclass(frozen=True)
class WeekOutflow:
    iso_year: int
    iso_week: int
    start: dt.date
    outflow_paisa: int
    is_largest: bool


def weekly_outflows(txns: list[Txn]) -> list[WeekOutflow]:
    """Outflow grouped by ISO week, largest week flagged (not by colour alone)."""
    weeks: dict[tuple[int, int], list[int]] = {}
    for t in txns:
        if t.is_inflow:
            continue
        d = dhaka_date(t.ts)
        iso = d.isocalendar()
        key = (iso[0], iso[1])
        weeks.setdefault(key, [0, 0])[0] += t.amount_paisa + t.fee_paisa
        # ISO week Monday.
        monday = d - dt.timedelta(days=d.isoweekday() - 1)
        weeks[key][1] = monday.toordinal()
    if not weeks:
        return []
    largest = max(v[0] for v in weeks.values())
    out = []
    for (y, w), (amount, monday_ord) in sorted(weeks.items(), key=lambda kv: kv[1][1]):
        out.append(
            WeekOutflow(
                iso_year=y,
                iso_week=w,
                start=dt.date.fromordinal(monday_ord),
                outflow_paisa=amount,
                is_largest=amount == largest,
            )
        )
    return out
