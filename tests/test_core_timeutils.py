"""Timezone and month-boundary tests (28/29/30/31-day cases)."""
import datetime as dt

import pytest

from core.timeutils import DHAKA, UTC, add_months, dhaka_date, to_dhaka


def test_add_months_clamps_day():
    assert add_months(dt.date(2026, 1, 31), 1) == dt.date(2026, 2, 28)  # 2026 not leap
    assert add_months(dt.date(2024, 1, 31), 1) == dt.date(2024, 2, 29)  # leap year
    assert add_months(dt.date(2026, 9, 30), 6) == dt.date(2027, 3, 30)


def test_dhaka_date_conversion():
    # 2026-09-30 20:30 UTC is 2026-10-01 02:30 in Dhaka (UTC+6).
    ts = dt.datetime(2026, 9, 30, 20, 30, tzinfo=UTC)
    assert dhaka_date(ts) == dt.date(2026, 10, 1)
    assert to_dhaka(ts).tzinfo == DHAKA


def test_naive_datetime_rejected():
    with pytest.raises(ValueError):
        to_dhaka(dt.datetime(2026, 9, 30, 20, 30))
