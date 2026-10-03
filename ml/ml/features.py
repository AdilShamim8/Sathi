"""Small feature helpers shared by the panel builder (ml/panel.py).

The forecaster's features live in ml/panel.py (origin state + target-day
calendar); this module keeps the income-timing projection used there.
"""
from __future__ import annotations

from core.recurring import IncomeTiming


def advance_timing(t: IncomeTiming, k: int) -> tuple[int, int]:
    """(days_since, days_to) k days after the timing's reference day, assuming
    the detected income period repeats. k=0 returns the reference values. Pure."""
    if k <= t.days_to_next_income or t.n_major < 2 or t.period_days <= 0:
        return t.days_since_income + k, max(t.days_to_next_income - k, 0)
    since = (k - t.days_to_next_income) % t.period_days
    return since, t.period_days - since
