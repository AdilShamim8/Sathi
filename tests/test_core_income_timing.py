"""Leakage-safe income timing: only inflows before the origin count."""
import datetime as dt

from core.recurring import income_timing

D = dt.date


def _monthly(day: int, months: int = 4):
    dates = [D(2026, m, day) for m in range(5, 5 + months)]
    return dates, [1_800_000] * len(dates)


def test_monthly_salary_detected():
    dates, amts = _monthly(7)
    t = income_timing(dates, amts, D(2026, 8, 20))
    assert t.days_since_income == 13
    assert 30 <= t.period_days <= 31
    assert t.days_to_next_income in (17, 18)


def test_future_transactions_never_change_features():
    dates, amts = _monthly(7)
    origin = D(2026, 8, 20)
    before = income_timing(dates, amts, origin)
    # A huge inflow on and after the origin must be invisible.
    after = income_timing(dates + [origin, D(2026, 8, 25)], amts + [9_000_000, 5_000_000], origin)
    assert before == after


def test_daily_earner_has_short_period():
    dates = [D(2026, 7, 1) + dt.timedelta(days=i) for i in range(40)]
    t = income_timing(dates, [100_000 + (i % 3) * 20_000 for i in range(40)], D(2026, 8, 10))
    assert t.period_days <= 2 and t.days_to_next_income <= 1


def test_no_history_is_capped():
    t = income_timing([], [], D(2026, 8, 1))
    assert t.n_major == 0 and t.days_to_next_income == 60
