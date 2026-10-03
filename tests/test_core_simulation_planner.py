"""Simulation and planner tests, including the monotonicity properties."""
import datetime as dt

import numpy as np

from core.planner import PlannerConfig, plan_goal
from core.simulation import shortfall_stats, simulate_balance_paths

CFG = PlannerConfig(n_simulations=2000, horizon_cap_months=36,
                    min_monthly_contribution_paisa=10_000)


def test_paths_shape_and_start():
    rng = np.random.default_rng(1)
    paths = simulate_balance_paths(
        residuals_paisa=np.array([-1_000, 2_000, -500] * 50),
        start_balance_paisa=50_000, horizon_days=30,
        block_length_days=5, n_paths=100, rng=rng,
    )
    assert paths.shape == (100, 31)
    assert (paths[:, 0] == 50_000).all()


def test_shortfall_extreme_cases():
    # Always-positive residuals: P(shortfall) must be 0.
    rng = np.random.default_rng(2)
    paths = simulate_balance_paths(np.full(100, 1_000), 100_000, 20, 5, 50, rng)
    p, trough, _ = shortfall_stats(paths, essentials_threshold_paisa=35_000, days_to_income=10)
    assert p == 0.0 and trough is not None
    # Always-negative residuals from a tiny balance: P(shortfall) must be 1.
    paths = simulate_balance_paths(np.full(100, -50_000), 10_000, 20, 5, 50, rng)
    p, trough, _ = shortfall_stats(paths, 35_000, 10)
    assert p == 1.0


def _pools():
    # Rina-like monthly surpluses: mostly +৳1,500, some bad months negative.
    surplus = np.array([150_000] * 8 + [-50_000, 80_000, 200_000, 120_000])
    inflow = np.array([1_800_000] * 12)
    return surplus, inflow


def test_planner_unlikely_goal_is_honest():
    # ৳30,000 in 6 months needs ৳5,000/month; surplus ~৳1,500 -> unlikely.
    surplus, inflow = _pools()
    plan = plan_goal(3_000_000, 6, surplus, inflow, 15_000, 50_000,
                     max_safe_contribution_paisa=400_000, config=CFG,
                     rng=np.random.default_rng(7), as_of_date=dt.date(2026, 9, 30))
    assert plan.monthly_required_paisa == 500_000
    assert plan.verdict in ("unlikely", "uncertain")
    assert 1 <= len(plan.options) <= 3
    keys = [o.key for o in plan.options]
    assert "extend_timeline" in keys
    for o in plan.options:
        assert 0.0 <= o.p_low <= o.p_goal_met <= o.p_high <= 1.0


def test_planner_more_time_never_lowers_probability():
    # Property: P(goal met) is non-decreasing in months, same seed/samples.
    surplus, inflow = _pools()
    ps = []
    for months in (3, 6, 12, 24):
        plan = plan_goal(3_000_000, months, surplus, inflow, 15_000, 50_000,
                         400_000, CFG, np.random.default_rng(99), dt.date(2026, 9, 30))
        ps.append(plan.p_requested)
    assert all(b >= a - 1e-9 for a, b in zip(ps, ps[1:])), ps


def test_planner_higher_contribution_never_lowers_probability():
    surplus, inflow = _pools()
    # Compare via the requested-plan probability at different targets over the
    # same horizon: a smaller target (higher effective contribution) must not
    # be harder. Same seed => common random numbers.
    p_hard = plan_goal(6_000_000, 12, surplus, inflow, 15_000, 50_000,
                       400_000, CFG, np.random.default_rng(5), dt.date(2026, 9, 30)).p_requested
    p_easy = plan_goal(1_200_000, 12, surplus, inflow, 15_000, 50_000,
                       400_000, CFG, np.random.default_rng(5), dt.date(2026, 9, 30)).p_requested
    assert p_easy >= p_hard - 1e-9


def test_planner_never_breaches_safety_buffer():
    surplus, inflow = _pools()
    plan = plan_goal(3_000_000, 6, surplus, inflow, 15_000, 50_000,
                     max_safe_contribution_paisa=100_000, config=CFG,
                     rng=np.random.default_rng(11), as_of_date=dt.date(2026, 9, 30))
    for o in plan.options:
        assert o.monthly_contribution_paisa <= 100_000 + 1  # paisa rounding slack


def test_planner_rejects_invalid_goal():
    surplus, inflow = _pools()
    import pytest
    with pytest.raises(ValueError):
        plan_goal(0, 6, surplus, inflow, 0, 0, 0, CFG, np.random.default_rng(1), dt.date(2026, 9, 30))


def test_goal_probabilities_are_platt_recalibrated():
    """T6 back-test: the raw i.i.d. simulation is ~3-5x optimistic, so every
    emitted probability passes through a Platt recalibration fitted on the
    frozen held-out users. Lock the contract: bin-anchored, monotone, and
    never claiming certainty."""
    from core.planner import _calibrate

    A, B = -2.4133, 0.5291
    # raw 0.105 must land near the realised 2.8% (frozen T6 bin, n=752)
    p = _calibrate(0.105, 2000, A, B)
    assert abs(p - 0.028) < 0.004
    # raw 0.276 near the realised 5.1% (frozen T6 bin, n=117)
    p2 = _calibrate(0.276, 2000, A, B)
    assert abs(p2 - 0.051) < 0.004
    # monotone across the whole range
    ps = [_calibrate(i / 100, 2000, A, B) for i in range(101)]
    assert all(a <= b + 1e-12 for a, b in zip(ps, ps[1:]))
    # an all-paths success is capped below certainty but stays "likely"
    certain = _calibrate(1.0, 2000, A, B)
    assert 0.7 <= certain < 1.0
    # impossibility stays impossible
    assert _calibrate(0.0, 2000, A, B) == 0.0


def test_plan_goal_calibrated_below_raw():
    """The shipped plan must be materially less optimistic than the raw
    simulator for a mid-feasibility goal (the audit finding)."""
    from core.planner import PlannerConfig as PC

    surplus, inflow = _pools()
    identity = PC(n_simulations=CFG.n_simulations, horizon_cap_months=CFG.horizon_cap_months,
                  min_monthly_contribution_paisa=CFG.min_monthly_contribution_paisa,
                  calibration_a=0.0, calibration_b=1.0)
    # a goal that is genuinely mid-feasibility for this pool
    target = 880_000
    raw = plan_goal(target, 6, surplus, inflow, 15_000, 50_000, 400_000, identity,
                    np.random.default_rng(5), dt.date(2026, 9, 30)).p_requested
    cal = plan_goal(target, 6, surplus, inflow, 15_000, 50_000, 400_000, CFG,
                    np.random.default_rng(5), dt.date(2026, 9, 30)).p_requested
    assert 0.05 < raw < 0.95      # mid-range, where the optimism lived
    assert cal < raw              # calibrated strictly below raw
    assert cal > 0                # but not zero
