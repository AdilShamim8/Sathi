"""Timezone helpers. All calendar logic runs in Asia/Dhaka; storage is UTC.

`as_of_date` (config) is the only 'today'. Wall-clock time is never used
for forecasts, goal deadlines or 'days until payday' (ADR-10).
"""
from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

DHAKA = ZoneInfo("Asia/Dhaka")
UTC = dt.timezone.utc


def to_dhaka(ts: dt.datetime) -> dt.datetime:
    """UTC (or any aware) timestamp -> aware Asia/Dhaka."""
    if ts.tzinfo is None:
        raise ValueError("naive datetime is a bug")
    return ts.astimezone(DHAKA)


def dhaka_date(ts: dt.datetime) -> dt.date:
    return to_dhaka(ts).date()


def month_start(d: dt.date) -> dt.date:
    return d.replace(day=1)


def add_months(d: dt.date, months: int) -> dt.date:
    """Add whole months, clamping the day (Jan 31 + 1 month -> Feb 28/29)."""
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    # Days in target month.
    if m == 12:
        next_first = dt.date(y + 1, 1, 1)
    else:
        next_first = dt.date(y, m + 1, 1)
    last_day = (next_first - dt.timedelta(days=1)).day
    return dt.date(y, m, min(d.day, last_day))


def days_between(a: dt.date, b: dt.date) -> int:
    return (b - a).days


def daterange(start: dt.date, end: dt.date):
    """Yield dates from start to end inclusive."""
    d = start
    while d <= end:
        yield d
        d += dt.timedelta(days=1)
