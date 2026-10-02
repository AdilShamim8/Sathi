"""Balance path simulation: seeded block bootstrap of daily net-flow residuals.

Blocks (not independent daily draws) keep day-to-day correlation; sampling
each day independently from quantiles would understate cumulative variance
and make P(shortfall) too optimistic (architecture §6.1).
"""
from __future__ import annotations

import math

import numpy as np


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
