"""Goal planner: Monte Carlo over the user's own surplus distribution.

Three honest option types (architecture §6.2):
  A: extend the timeline at a feasible contribution
  B: trim a named leakage (fees + avoidable spend) and redirect it
  C: save a percentage of each inflow (suits irregular earners)

Common random numbers (one pre-sampled surplus matrix) make P(goal met)
monotonic in contribution and in time by construction, which the property
tests rely on. The essentials safety buffer caps every contribution
(invariant 16). No option is pre-selected or promoted.
"""
from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass

import numpy as np

from core.timeutils import add_months


@dataclass(frozen=True)
class PlannerConfig:
    n_simulations: int
    horizon_cap_months: int
    min_monthly_contribution_paisa: int
    likely_cutoff: float = 0.70
    uncertain_cutoff: float = 0.40


@dataclass(frozen=True)
class PlanOption:
    key: str                            # "extend_timeline" | "trim_leakage" | "percent_of_inflow"
    monthly_contribution_paisa: int     # for C: the expected monthly amount
    percent_of_inflow: float | None     # only for C
    months: int
    p_goal_met: float
    p_low: float                        # Wilson 95% interval: honest simulation range
    p_high: float
    tradeoff_bn: str
    tradeoff_en: str


@dataclass(frozen=True)
class GoalPlan:
    target_paisa: int
    requested_months: int
    monthly_required_paisa: int
    p_requested: float
    verdict: str                        # "likely" | "uncertain" | "unlikely"
    options: list[PlanOption]
    feasibility_note_bn: str
    feasibility_note_en: str


def _wilson(p: float, n: int) -> tuple[float, float]:
    """95% Wilson score interval for a binomial proportion."""
    if n == 0:
        return 0.0, 1.0
    z = 1.959963984540054
    denom = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denom
    margin = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    # Clamp around p: float noise must not push the bound past the estimate.
    lo = min(max(0.0, centre - margin), p)
    hi = max(min(1.0, centre + margin), p)
    return lo, hi


def _simulate_fixed(S: np.ndarray, target_paisa: int, monthly: int, months: int) -> float:
    """P(cumulative min(monthly, surplus) reaches target within `months`).

    S: (n_sims, max_months) pre-sampled monthly surpluses (common random
    numbers). Contribution in a month never exceeds that month's surplus.
    """
    horizon = min(months, S.shape[1])
    contrib = np.minimum(monthly, np.maximum(S[:, :horizon], 0))
    reached = (np.cumsum(contrib, axis=1) >= target_paisa).any(axis=1)
    return float(reached.mean())


def _simulate_percent(S_inflow: np.ndarray, target_paisa: int, rate: float, months: int) -> float:
    horizon = min(months, S_inflow.shape[1])
    contrib = np.maximum(S_inflow[:, :horizon], 0) * rate
    reached = (np.cumsum(contrib, axis=1) >= target_paisa).any(axis=1)
    return float(reached.mean())


def plan_goal(
    target_paisa: int,
    months: int,
    monthly_surplus_samples_paisa: np.ndarray,
    monthly_inflow_samples_paisa: np.ndarray,
    monthly_fee_leakage_paisa: int,
    monthly_avoidable_paisa: int,
    max_safe_contribution_paisa: int,
    config: PlannerConfig,
    rng: np.random.Generator,
    as_of_date: dt.date,
) -> GoalPlan:
    """Build the requested-plan verdict plus up to three honest options.

    Pools are the user's historical monthly surpluses/inflows (paisa). The
    caller guarantees non-empty pools (persona priors when history is thin).
    """
    if target_paisa <= 0 or months <= 0:
        raise ValueError("target_paisa and months must be positive")

    pool_s = np.asarray(monthly_surplus_samples_paisa, dtype=np.int64)
    pool_i = np.asarray(monthly_inflow_samples_paisa, dtype=np.int64)
    S = rng.choice(pool_s, size=(config.n_simulations, config.horizon_cap_months), replace=True)
    I = rng.choice(pool_i, size=(config.n_simulations, config.horizon_cap_months), replace=True)

    monthly_required = math.ceil(target_paisa / months)
    p_requested = _simulate_fixed(S, target_paisa, monthly_required, months)
    if p_requested >= config.likely_cutoff:
        verdict = "likely"
    elif p_requested >= config.uncertain_cutoff:
        verdict = "uncertain"
    else:
        verdict = "unlikely"

    # Feasible base contribution: median positive surplus, floored and capped.
    positive = pool_s[pool_s > 0]
    base = int(np.median(positive)) if positive.size else 0
    base = max(base, config.min_monthly_contribution_paisa)
    base = min(base, max_safe_contribution_paisa)

    options: list[PlanOption] = []

    # --- Option A: extend the timeline at the feasible contribution ---------
    if base > 0:
        months_a = min(math.ceil(target_paisa / base), config.horizon_cap_months)
        p_a = _simulate_fixed(S, target_paisa, base, months_a)
        lo, hi = _wilson(p_a, config.n_simulations)
        options.append(PlanOption(
            key="extend_timeline",
            monthly_contribution_paisa=base,
            percent_of_inflow=None,
            months=months_a,
            p_goal_met=p_a, p_low=lo, p_high=hi,
            tradeoff_bn="বেশি সময় লাগবে, তবে মাসিক অংক ছোট ও টেকসই",
            tradeoff_en="Takes longer, but the monthly amount stays small and sustainable",
        ))

    # --- Option B: trim the named leakage, redirect it to the goal ----------
    leakage = monthly_fee_leakage_paisa + monthly_avoidable_paisa
    if leakage > 0 and base >= 0:
        contrib_b = min(base + leakage, max_safe_contribution_paisa)
        if contrib_b > 0:
            months_b = min(math.ceil(target_paisa / contrib_b), config.horizon_cap_months)
            p_b = _simulate_fixed(S, target_paisa, contrib_b, months_b)
            lo, hi = _wilson(p_b, config.n_simulations)
            options.append(PlanOption(
                key="trim_leakage",
                monthly_contribution_paisa=contrib_b,
                percent_of_inflow=None,
                months=months_b,
                p_goal_met=p_b, p_low=lo, p_high=hi,
                tradeoff_bn="ক্যাশ-আউট ফি ও এড়ানো যায় এমন খরচ কমিয়ে সেই টাকা জমানো হবে",
                tradeoff_en="Redirects cash-out fees and avoidable spend into the goal",
            ))

    # --- Option C: percentage of each inflow (irregular-income friendly) ----
    median_inflow = float(np.median(pool_i)) if pool_i.size else 0.0
    if median_inflow > 0:
        rate_needed = monthly_required / median_inflow
        rate = min(max(rate_needed, 0.05), 0.50)   # 5%-50% sane band
        expected_monthly = int(median_inflow * rate)
        if expected_monthly <= max_safe_contribution_paisa:
            p_c = _simulate_percent(I, target_paisa, rate, months)
            lo, hi = _wilson(p_c, config.n_simulations)
            options.append(PlanOption(
                key="percent_of_inflow",
                monthly_contribution_paisa=int(expected_monthly),
                percent_of_inflow=rate,
                months=months,
                p_goal_met=p_c, p_low=lo, p_high=hi,
                tradeoff_bn="আয় আসার সঙ্গে সঙ্গে একটি নির্দিষ্ট অংশ আলাদা রাখা হয়",
                tradeoff_en="Sets aside a fixed share the moment income arrives",
            ))

    # Honest headline (kind, plain, always with a next step).
    if verdict == "unlikely":
        note_bn = "এই সময়ে এই লক্ষ্য পৌঁছানো কঠিন। নিচের বিকল্পগুলো দেখুন — সিদ্ধান্ত আপনার।"
        note_en = "This goal is unlikely in the requested time. The options below are more realistic — you decide."
    elif verdict == "uncertain":
        note_bn = "লক্ষ্যটি সম্ভব, তবে ঝুঁকি আছে। বিকল্প পরিকল্পনাগুলো তুলনা করে দেখুন।"
        note_en = "Possible, but not certain. Compare the options below."
    else:
        note_bn = "আপনার ইতিহাস অনুযায়ী এই লক্ষ্য অর্জনযোগ্য মনে হচ্ছে।"
        note_en = "Given your history, this goal looks achievable."

    deadline = add_months(as_of_date, months)
    _ = deadline  # deadline is rendered by the API layer from as_of_date
    return GoalPlan(
        target_paisa=target_paisa,
        requested_months=months,
        monthly_required_paisa=monthly_required,
        p_requested=p_requested,
        verdict=verdict,
        options=options,
        feasibility_note_bn=note_bn,
        feasibility_note_en=note_en,
    )
