"""Path simulator, stream detection, model safe-to-spend and cash-on-hand v2."""
import datetime as dt

import numpy as np
from scipy.stats import norm

from core.cash_on_hand import cash_time_constant_days, estimate_cash_v2
from core.recurring import detect_streams
from core.safe_to_spend import safe_to_spend_from_paths
from core.simulation import (
    block_correlated_uniforms,
    inverse_cdf,
    sample_stream_flows,
    simulate_liquidity_paths,
)

D = dt.date
TAUS = np.round(np.arange(0.1, 0.91, 0.1), 2)


def _gauss_q(h, sd=1_000.0):
    return np.tile(norm.ppf(TAUS) * sd, (h, 1))


def test_inverse_cdf_recovers_quantiles():
    q = _gauss_q(3)
    u = np.tile(TAUS, (3, 1)).T[:, :3]  # (T, H) with u = tau
    vals = inverse_cdf(q, TAUS, u)
    assert np.allclose(vals[:, 0], q[0], atol=1e-6)


def test_block_uniforms_are_uniform_and_correlated():
    rng = np.random.default_rng(0)
    u = block_correlated_uniforms(20_000, 14, 0.8, 7, rng)
    assert abs(u.mean() - 0.5) < 0.01
    z = norm.ppf(u)
    assert np.corrcoef(z[:, 0], z[:, 1])[0, 1] > 0.5      # same block
    assert abs(np.corrcoef(z[:, 0], z[:, 7])[0, 1]) < 0.05  # next block


def test_safe_to_spend_keeps_shortfall_at_alpha():
    """Toy random walk: spending the safe amount leaves P(shortfall) = alpha."""
    h, floor = 20, 50_000
    sched = np.zeros((40_000, h), dtype=np.int64)
    p1 = simulate_liquidity_paths(200_000, _gauss_q(h), TAUS, sched, 0.3, 7, np.random.default_rng(1))
    safe = safe_to_spend_from_paths(p1, floor, alpha=0.10)
    p2 = simulate_liquidity_paths(200_000 - safe, _gauss_q(h), TAUS, sched, 0.3, 7, np.random.default_rng(2))
    p_short = float(np.mean(p2[:, 1:].min(axis=1) < floor))
    assert abs(p_short - 0.10) <= 0.01


def test_detect_monthly_salary_and_ignore_random_merchants():
    rng = np.random.default_rng(3)
    ev = [(D(2026, m, 7), "salary_in|employer", 1, 1_600_000 + int(rng.integers(-50_000, 50_000)))
          for m in range(1, 8)]
    days = sorted(rng.choice(200, 12, replace=False))
    ev += [(D(2026, 1, 1) + dt.timedelta(days=int(d)), "payment|merch_x", -1, int(rng.integers(2_000, 20_000)))
           for d in days]
    streams = detect_streams(ev, D(2026, 8, 1))
    assert [s.key for s in streams] == ["salary_in|employer"]
    s = streams[0]
    assert 28 <= s.period_days <= 31 and s.direction == 1
    # Events on/after the origin are invisible.
    assert detect_streams(ev, D(2026, 3, 1)) == detect_streams(ev + [(D(2026, 3, 1), "x|y", 1, 5)] * 5, D(2026, 3, 1))


def test_stream_flows_land_on_schedule():
    ev = [(D(2026, m, 7), "rent", -1, 500_000) for m in range(1, 8)]
    s = detect_streams(ev, D(2026, 7, 20))
    flows = sample_stream_flows(s, D(2026, 7, 20), 30, 200, np.random.default_rng(4))
    # One rent payment of 5,000 per path, around Aug 7 (day 18 after origin).
    assert (flows.sum(axis=1) == -500_000).all()
    hit_days = np.nonzero(flows)[1] + 1
    assert 15 <= hit_days.min() and hit_days.max() <= 21


def test_cash_v2_decays_with_user_cadence():
    dates = [D(2026, 5, 1) + dt.timedelta(days=4 * i) for i in range(10)]
    tc = cash_time_constant_days(dates)
    assert tc == 4.0
    fresh = estimate_cash_v2([D(2026, 6, 10)], [100_000], D(2026, 6, 10), tc)
    later = estimate_cash_v2([D(2026, 6, 10)], [100_000], D(2026, 6, 14), tc)
    assert fresh == 100_000 and 0 < later < 40_000
    assert estimate_cash_v2([D(2026, 6, 15)], [100_000], D(2026, 6, 14), tc) == 0


def test_side_payments_do_not_break_salary_stream():
    ev = [(D(2026, m, 7), "salary_in|employer", 1, 1_600_000) for m in range(1, 8)]
    ev += [(D(2026, 3, 12), "salary_in|employer", 1, 600_000), (D(2026, 5, 20), "salary_in|employer", 1, 500_000)]
    streams = detect_streams(ev, D(2026, 8, 1))
    assert len(streams) == 1 and 28 <= streams[0].period_days <= 31
