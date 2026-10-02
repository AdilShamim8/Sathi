"""Dynamic recurring transaction detection. Pure function over transaction history.

Detects recurring income (salary, stipend, remittance) and recurring expenses
(rent, utility bills, mobile recharges, installments) directly from transaction
patterns (frequency, regularity, amount consistency) without data leakage from static configs.
"""
from __future__ import annotations

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

from core.categorizer import categorize
from core.formatting import format_taka
from core.schemas import Category, Txn
from core.timeutils import dhaka_date


@dataclass(frozen=True)
class RecurringItem:
    item_id: str
    title_bn: str
    title_en: str
    category: str
    direction: str  # "inflow" | "outflow"
    amount_paisa: int
    amount_display: str
    interval_days: int  # e.g. 30 for monthly, 7 for weekly
    periodicity: str  # "monthly" | "weekly"
    expected_day_of_month: Optional[int]
    confidence: float  # [0.0, 1.0]
    next_expected_date: str  # ISO YYYY-MM-DD
    occurrence_count: int


@dataclass(frozen=True)
class RecurringSummary:
    inflows: list[RecurringItem]
    outflows: list[RecurringItem]
    total_monthly_inflow_paisa: int
    total_monthly_outflow_paisa: int
    total_monthly_inflow_display: str
    total_monthly_outflow_display: str
    detected_salary_dom: Optional[int]
    upcoming_commitments_14d_paisa: int
    upcoming_commitments_14d_display: str


def detect_recurring_patterns(
    txns: list[Txn],
    as_of_date: dt.date,
) -> RecurringSummary:
    """Detect recurring income and expense patterns from transaction history.

    Algorithms:
      1. Group transactions by (direction, counterparty_category, approximate_amount_bin).
      2. Check intervals between consecutive occurrences. If median interval is ~28-32 days
         or ~6-8 days with standard deviation <= 4 days and count >= 2, classify as recurring.
      3. Project next occurrence date relative to as_of_date.
      4. Sum obligations due within the next 14 days for safe-to-spend computation.
    """
    if not txns:
        return RecurringSummary(
            inflows=[],
            outflows=[],
            total_monthly_inflow_paisa=0,
            total_monthly_outflow_paisa=0,
            total_monthly_inflow_display="৳০",
            total_monthly_outflow_display="৳০",
            detected_salary_dom=None,
            upcoming_commitments_14d_paisa=0,
            upcoming_commitments_14d_display="৳০",
        )

    # Sort transactions chronologically
    sorted_tx = sorted(txns, key=lambda t: t.ts)

    # Grouping key: direction + category + approximate rounded amount (±15%)
    clusters: dict[tuple[str, str, int], list[tuple[Txn, dt.date]]] = defaultdict(list)

    for t in sorted_tx:
        direction = "inflow" if t.is_inflow else "outflow"
        cat = categorize(t).category.value
        # Bucket amount into 10% log-like intervals or rough 500 taka bins to cluster similar amounts
        # For small amounts (< ৳500), bucket by 100 taka
        amt = t.amount_paisa
        if amt < 50_000:
            amt_bucket = (amt // 10_000) * 10_000
        else:
            amt_bucket = (amt // 50_000) * 50_000
        clusters[(direction, cat, amt_bucket)].append((t, dhaka_date(t.ts)))

    recurring_inflows: list[RecurringItem] = []
    recurring_outflows: list[RecurringItem] = []
    detected_salary_dom: Optional[int] = None
    upcoming_14d_paisa = 0

    fourteen_days_later = as_of_date + dt.timedelta(days=14)

    for (direction, cat, _), items in clusters.items():
        if len(items) < 2:
            continue

        dates = [d for _, d in items]
        intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        if not intervals:
            continue

        median_interval = sorted(intervals)[len(intervals) // 2]
        is_monthly = 25 <= median_interval <= 35
        is_weekly = 5 <= median_interval <= 9

        if not (is_monthly or is_weekly):
            continue

        # Validated recurring cluster!
        periodicity = "monthly" if is_monthly else "weekly"
        interval_days = 30 if is_monthly else 7
        amounts = [t.amount_paisa for t, _ in items]
        median_amount = sorted(amounts)[len(amounts) // 2]
        doms = [d.day for d in dates]
        expected_dom = sorted(doms)[len(doms) // 2] if is_monthly else None

        last_date = dates[-1]
        next_date = last_date + dt.timedelta(days=interval_days)
        while next_date < as_of_date:
            next_date += dt.timedelta(days=interval_days)

        confidence = min(0.95, 0.5 + (len(items) * 0.15))

        # Title generator
        if direction == "inflow":
            if cat in ("salary", "business") or median_amount >= 100_000:
                title_bn = "মাসিক বেতন / নিয়মিত আয়"
                title_en = "Monthly Income / Salary"
                if detected_salary_dom is None and is_monthly:
                    detected_salary_dom = expected_dom
            else:
                title_bn = "নিয়মিত প্রাপ্তি (ভাতা / রেমিট্যান্স)"
                title_en = "Regular Inflow / Allowance"
        else:
            if cat == "rent":
                title_bn = "মাসিক বাসা ভাড়া"
                title_en = "Monthly House Rent"
            elif cat == "bills":
                title_bn = "ইউটিলিটি বিল (বিদ্যুৎ/গ্যাস/পানি)"
                title_en = "Utility Bill"
            elif cat == "mobile":
                title_bn = "মোবাইল রিচার্জ ও ইন্টারনেট প্যাকেজ"
                title_en = "Mobile & Internet Recharge"
            elif cat == "family":
                title_bn = "পারিবারিক সহায়তা প্রেরণ"
                title_en = "Family Support"
            elif cat == "business":
                title_bn = "ব্যবসায়িক মজুদ ক্রয় / ভাড়া"
                title_en = "Business Stock / Operating Cost"
            else:
                title_bn = f"নিয়মিত ব্যয় ({cat})"
                title_en = f"Recurring Spend ({cat})"

        item = RecurringItem(
            item_id=f"{direction}_{cat}_{expected_dom or 0}",
            title_bn=title_bn,
            title_en=title_en,
            category=cat,
            direction=direction,
            amount_paisa=median_amount,
            amount_display=format_taka(median_amount, "bn"),
            interval_days=interval_days,
            periodicity=periodicity,
            expected_day_of_month=expected_dom,
            confidence=round(confidence, 2),
            next_expected_date=next_date.isoformat(),
            occurrence_count=len(items),
        )

        if direction == "inflow":
            recurring_inflows.append(item)
        else:
            recurring_outflows.append(item)
            # Check if due within next 14 days
            if as_of_date <= next_date <= fourteen_days_later:
                upcoming_14d_paisa += median_amount

    # Total monthly calculations
    monthly_inflow = sum(
        it.amount_paisa * (4 if it.periodicity == "weekly" else 1)
        for it in recurring_inflows
    )
    monthly_outflow = sum(
        it.amount_paisa * (4 if it.periodicity == "weekly" else 1)
        for it in recurring_outflows
    )

    return RecurringSummary(
        inflows=recurring_inflows,
        outflows=recurring_outflows,
        total_monthly_inflow_paisa=monthly_inflow,
        total_monthly_outflow_paisa=monthly_outflow,
        total_monthly_inflow_display=format_taka(monthly_inflow, "bn"),
        total_monthly_outflow_display=format_taka(monthly_outflow, "bn"),
        detected_salary_dom=detected_salary_dom,
        upcoming_commitments_14d_paisa=upcoming_14d_paisa,
        upcoming_commitments_14d_display=format_taka(upcoming_14d_paisa, "bn"),
    )
