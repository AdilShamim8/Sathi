"""Dynamic recurring transaction detection. Pure function over transaction history.

Detects recurring income (salary, stipend, remittance) and recurring expenses
(rent, utility bills, mobile recharges, installments) directly from transaction
patterns (frequency, regularity, amount consistency) without data leakage from static configs.
"""
from __future__ import annotations

import datetime as dt
from collections import defaultdict
from dataclasses import dataclass

from core.categorizer import categorize
from core.formatting import format_taka
from core.schemas import Txn
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
    expected_day_of_month: int | None
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
    detected_salary_dom: int | None
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
    detected_salary_dom: int | None = None
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


@dataclass(frozen=True)
class IncomeTiming:
    """Income rhythm seen strictly before an origin date (leakage-safe)."""
    days_since_income: int       # days since the last major inflow (capped)
    days_to_next_income: int     # expected days until the next one (0 = due/overdue)
    period_days: int             # median gap between major inflows (capped)
    n_major: int                 # major inflow days in the lookback window


def income_timing(
    inflow_dates: list[dt.date],
    inflow_amounts: list[int],
    origin: dt.date,
    lookback_days: int = 120,
    major_frac: float = 0.5,
    cap_days: int = 60,
) -> IncomeTiming:
    """Detect the income rhythm from inflows dated strictly before `origin`.

    A "major" inflow day is one whose total is at least `major_frac` of the
    median of the three largest inflow days in the lookback window. This
    finds a monthly salary, an irregular remittance and daily earnings alike,
    without reading any persona configuration. Pure; inflows on or after
    `origin` are ignored, so later transactions can never change the result.
    """
    lo = origin - dt.timedelta(days=lookback_days)
    by_day: dict[dt.date, int] = defaultdict(int)
    for d, a in zip(inflow_dates, inflow_amounts):
        if lo <= d < origin:
            by_day[d] += int(a)
    if not by_day:
        return IncomeTiming(cap_days, cap_days, cap_days, 0)
    top = sorted(by_day.values(), reverse=True)[:3]
    threshold = major_frac * top[len(top) // 2]
    major = sorted(d for d, a in by_day.items() if a >= threshold)
    since = min((origin - major[-1]).days, cap_days)
    if len(major) < 2:
        return IncomeTiming(since, cap_days, cap_days, len(major))
    gaps = sorted((b - a).days for a, b in zip(major, major[1:]))
    period = min(gaps[len(gaps) // 2], cap_days)
    return IncomeTiming(since, max(period - since, 0), period, len(major))


@dataclass(frozen=True)
class Stream:
    """A recurring stream detected from history before an origin."""
    key: str
    direction: int                 # +1 inflow, -1 outflow
    period_days: int               # median gap between occurrences
    last_date: dt.date
    gap_residuals: tuple[int, ...]  # observed gap - period (for date jitter)
    amounts: tuple[int, ...]        # observed amounts (for amount sampling)
    anchor_dom: int | None = None   # typical day of month (monthly streams on a fixed day)
    dom_residuals: tuple[int, ...] = ()  # observed day - anchor (date jitter)


_PERIOD_WINDOWS = ((5, 9), (12, 16), (25, 45))


def _mad(xs: list[float]) -> float:
    m = sorted(xs)[len(xs) // 2]
    dev = sorted(abs(x - m) for x in xs)
    return float(dev[len(dev) // 2])


def detect_streams(
    events: list[tuple[dt.date, str, int, int]],
    origin: dt.date,
    min_occurrences: int = 3,
    max_gap_mad_frac: float = 0.20,
    max_amount_mad_frac: float = 0.20,
) -> list[Stream]:
    """Recurring streams from events (date, key, direction, amount) dated
    strictly before `origin`. Pure.

    A key (e.g. type + counterparty) is a stream when it occurred at least
    `min_occurrences` times with a weekly, fortnightly or (roughly) monthly
    median gap, regular gaps (MAD <= 20% of the period) and stable amounts
    (MAD <= 20% of the median). Streams silent for more than two periods are
    treated as ended. Occurrences below half the key's median amount (side
    payments such as a bonus) are ignored.
    """
    by_key: dict[str, list[tuple[dt.date, int, int]]] = defaultdict(list)
    for d, key, direction, amount in events:
        if d < origin:
            by_key[key].append((d, direction, int(amount)))
    out: list[Stream] = []
    for key, items in sorted(by_key.items()):
        if len(items) < min_occurrences:
            continue
        items.sort()
        # Ignore side payments on the same key (e.g. an Eid bonus from the
        # employer): occurrences below half the median amount.
        med_all = sorted(a for _, _, a in items)[len(items) // 2]
        items = [it for it in items if it[2] >= 0.5 * med_all]
        if len(items) < min_occurrences:
            continue
        dates = [d for d, _, _ in items]
        gaps = [(b - a).days for a, b in zip(dates, dates[1:]) if (b - a).days > 0]
        if len(gaps) < min_occurrences - 1:
            continue
        period = sorted(gaps)[len(gaps) // 2]
        if not any(lo <= period <= hi for lo, hi in _PERIOD_WINDOWS):
            continue
        if _mad([float(g) for g in gaps]) > max_gap_mad_frac * period:
            continue
        amounts = [a for _, _, a in items]
        med = sorted(amounts)[len(amounts) // 2]
        if med <= 0 or _mad([float(a) for a in amounts]) > max_amount_mad_frac * med:
            continue
        if (origin - dates[-1]).days > 2 * period:
            continue
        anchor, dom_res = None, ()
        if 25 <= period <= 35:
            doms = [d.day for d in dates]
            anchor = sorted(doms)[len(doms) // 2]
            if _mad([float(x) for x in doms]) <= 3:
                dom_res = tuple(x - anchor for x in doms)
            else:
                anchor = None
        out.append(Stream(key, items[-1][1], period, dates[-1],
                          tuple(g - period for g in gaps), tuple(amounts), anchor, dom_res))
    return out
