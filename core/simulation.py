"""Balance path simulation: seeded block bootstrap of daily net-flow residuals.

Blocks (not independent daily draws) keep day-to-day correlation; sampling
each day independently from quantiles would understate cumulative variance
and make P(shortfall) too optimistic (architecture §6.1).
"""
from __future__ import annotations

import math

import numpy as np
from scipy.special import ndtr


def simulate_balance_paths(
    residuals_paisa: np.ndarray,
    start_balance_paisa: int,
    horizon_days: int,
    block_length_days: int,
    n_paths: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """Return shape (n_paths, horizon_days+1): simulated daily balances (paisa).

    Column 0 is the start balance. Residuals are sampled in random blocks to
    preserve autocorrelation. Pure: the caller passes history and the RNG.
    """
    residuals_paisa = np.asarray(residuals_paisa, dtype=np.int64)
    if horizon_days <= 0 or n_paths <= 0:
        return np.full((max(n_paths, 1), 1), start_balance_paisa, dtype=np.int64)
    if residuals_paisa.size < block_length_days:
        # Too little history: repeat what exists. Callers mark confidence low.
        residuals_paisa = np.resize(residuals_paisa, max(block_length_days, 1))

    n_blocks = math.ceil(horizon_days / block_length_days)
    max_start = residuals_paisa.size - block_length_days
    starts = rng.integers(0, max_start + 1, size=(n_paths, n_blocks))
    idx = starts[:, :, None] + np.arange(block_length_days)[None, None, :]
    blocks = residuals_paisa[idx]                       # (paths, blocks, block)
    flows = blocks.reshape(n_paths, n_blocks * block_length_days)[:, :horizon_days]
    paths = np.empty((n_paths, horizon_days + 1), dtype=np.int64)
    paths[:, 0] = start_balance_paisa
    paths[:, 1:] = start_balance_paisa + np.cumsum(flows, axis=1)
    return paths


def shortfall_stats(
    paths_paisa: np.ndarray,
    essentials_threshold_paisa: int,
    days_to_income: int,
) -> tuple[float, int | None, np.ndarray]:
    """P(shortfall) before the next income, plus the median trough day offset.

    Shortfall = balance dips below the essentials threshold within
    days_to_income. Returns (probability, median_trough_day_offset, min_balance
    per path). day offset is 1-based (day 1 = tomorrow).
    """
    window = paths_paisa[:, 1 : days_to_income + 1] if days_to_income >= 1 else paths_paisa[:, 1:]
    if window.shape[1] == 0:
        return 0.0, None, paths_paisa[:, -1]
    min_balance = window.min(axis=1)
    p_shortfall = float(np.mean(min_balance < essentials_threshold_paisa))
    trough_days = window.argmin(axis=1) + 1
    median_trough = int(np.median(trough_days))
    return p_shortfall, median_trough, min_balance


def inverse_cdf(quantiles: np.ndarray, taus: np.ndarray, u: np.ndarray) -> np.ndarray:
    """Piecewise-linear inverse CDF through predicted quantiles. Pure.

    quantiles: (H, T) sorted per row, taus: (T,), u: (P, H) in (0, 1).
    Tails beyond the outer quantiles are extrapolated linearly with the slope
    of the outermost pair (out to tau = 0 and tau = 1).
    """
    q = np.sort(np.asarray(quantiles, dtype=float), axis=1)
    lo = q[:, :1] - (q[:, 1:2] - q[:, :1]) / (taus[1] - taus[0]) * taus[0]
    hi = q[:, -1:] + (q[:, -1:] - q[:, -2:-1]) / (taus[-1] - taus[-2]) * (1 - taus[-1])
    grid_q = np.concatenate([lo, q, hi], axis=1)
    grid_t = np.concatenate([[0.0], taus, [1.0]])
    out = np.empty_like(u, dtype=float)
    for h in range(q.shape[0]):
        out[:, h] = np.interp(u[:, h], grid_t, grid_q[h])
    return out


def block_correlated_uniforms(n_paths: int, horizon: int, rho: float, block_days: int,
                              rng: np.random.Generator) -> np.ndarray:
    """(P, H) uniforms; days in the same block share a common shock with
    correlation `rho`, so bad days cluster (cumulative risk is not
    understated as with independent daily draws)."""
    n_blocks = -(-horizon // block_days)
    zb = np.repeat(rng.standard_normal((n_paths, n_blocks)), block_days, axis=1)[:, :horizon]
    zd = rng.standard_normal((n_paths, horizon))
    z = rho * zb + np.sqrt(max(1 - rho ** 2, 0.0)) * zd
    return np.clip(ndtr(z), 1e-4, 1 - 1e-4)


def sample_stream_flows(streams, origin, horizon: int, n_paths: int,
                        rng: np.random.Generator) -> np.ndarray:
    """(P, H) scheduled flows (signed paisa) from detected recurring streams.

    Each path draws its own date jitter (from the stream's observed gap
    residuals) and amount (from its observed amounts). A stream already due
    arrives within the next few days (late payment); a stream missed by more
    than half a period skips to its next cycle.
    """
    flows = np.zeros((n_paths, horizon), dtype=np.int64)
    for s in streams:
        if getattr(s, "anchor_dom", None):
            _monthly_anchor_flows(flows, s, origin, horizon, rng)
            continue
        resid = np.asarray(s.gap_residuals or (0,), dtype=int)
        amts = np.asarray(s.amounts, dtype=np.int64)
        offset = (s.last_date - origin).days + s.period_days + rng.choice(resid, n_paths)
        # offset = days after origin of the next occurrence (day 1 = tomorrow).
        late = offset <= 0
        missed = late & (-offset >= s.period_days / 2)
        offset = np.where(missed, offset + s.period_days, offset)
        offset = np.where(late & ~missed, 1 + rng.integers(0, 3, n_paths), offset)
        offset = np.maximum(offset, 1)
        while (offset <= horizon).any():
            hit = offset <= horizon
            idx = np.nonzero(hit)[0]
            flows[idx, offset[idx] - 1] += s.direction * rng.choice(amts, idx.size)
            offset = offset + np.maximum(s.period_days + rng.choice(resid, n_paths), 1)
    return flows


def simulate_liquidity_paths(
    start_paisa: int,
    irregular_quantiles: np.ndarray,
    taus: np.ndarray,
    scheduled_flows: np.ndarray,
    rho: float,
    block_days: int,
    rng: np.random.Generator,
) -> np.ndarray:
    """(P, H+1) wallet paths: start + scheduled + irregular, never below zero.

    irregular_quantiles: (H, T) predicted quantiles of the daily irregular
    net flow (paisa); scheduled_flows: (P, H) from `sample_stream_flows`.
    Column 0 is the start. Pure given the RNG.
    """
    n_paths, horizon = scheduled_flows.shape
    u = block_correlated_uniforms(n_paths, horizon, rho, block_days, rng)
    irregular = inverse_cdf(irregular_quantiles, np.asarray(taus, dtype=float), u)
    irregular = np.rint(irregular).astype(np.int64)
    paths = np.empty((n_paths, horizon + 1), dtype=np.int64)
    paths[:, 0] = start_paisa
    bal = np.full(n_paths, start_paisa, dtype=np.int64)
    # A wallet cannot go below zero: scheduled inflows land first, spending is
    # capped at what is there, and a scheduled payment larger than the balance
    # does not happen that day (paid in cash, late or not at all).
    for h in range(horizon):
        sched = scheduled_flows[:, h]
        bal = bal + np.maximum(sched, 0)
        bal = np.maximum(bal + irregular[:, h], 0)
        out = -np.minimum(sched, 0)
        bal = np.where(out <= bal, bal - out, bal)
        paths[:, h + 1] = bal
    return paths


def _monthly_anchor_flows(flows: np.ndarray, s, origin, horizon: int, rng: np.random.Generator) -> None:
    """Fixed-day monthly stream (salary on the 7th, rent on the 8th): each
    month's date is the anchor day plus an observed jitter, so one late
    payment does not shift the next one. A month already paid (an
    occurrence within the last half period) is skipped."""
    import datetime as dt
    n_paths = flows.shape[0]
    resid = np.asarray(s.dom_residuals or (0,), dtype=int)
    amts = np.asarray(s.amounts, dtype=np.int64)
    first = dt.date(origin.year, origin.month, 1)
    for m in range(-1, horizon // 28 + 2):
        y, mo = first.year + (first.month - 1 + m) // 12, (first.month - 1 + m) % 12 + 1
        base = dt.date(y, mo, min(s.anchor_dom, 28))
        if (base - s.last_date).days < s.period_days / 2:
            continue                       # this cycle already happened
        off = (base - origin).days + rng.choice(resid, n_paths)
        if (base - origin).days < -7:
            continue                       # more than a week overdue: treated as missed
        off = np.where(off <= 0, 1 + rng.integers(0, 3, n_paths), off)  # slightly late: arrives soon
        hit = off <= horizon
        idx = np.nonzero(hit)[0]
        flows[idx, off[idx] - 1] += s.direction * rng.choice(amts, idx.size)
