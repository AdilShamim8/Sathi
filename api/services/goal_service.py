"""Goal planning service: calls pure core/planner.py with historical surplus samples."""
from __future__ import annotations

import datetime as dt
import sqlite3

import numpy as np

from api.errors import NotFoundError
from api.repositories import transactions as tx_repo
from api.repositories import users as users_repo
from api.schemas.common import Evidence
from api.schemas.extended import GoalPlanData, GoalPlanOptionOut
from api.services import convert
from api.services.evidence import as_of_date, build_evidence
from core.formatting import format_probability, format_taka
from core.metrics import monthly_totals
from core.planner import PlannerConfig, plan_goal
from ml.inference import load_latest_version


def create_goal_plan(
    conn: sqlite3.Connection,
    cfg,
    user_id: str,
    goal_type: str,
    target_paisa: int,
    months: int,
) -> tuple[GoalPlanData, Evidence]:
    user = users_repo.get_user(conn, user_id)
    if user is None:
        raise NotFoundError()

    rows = tx_repo.list_for_user(conn, user_id)
    txns = [convert.row_to_txn(r) for r in rows]
    origin = as_of_date(cfg)
    totals = monthly_totals(txns)

    # Surplus and inflow samples
    surplus_samples = []
    inflow_samples = []
    for ym, (inflow, outflow) in totals.items():
        surplus_samples.append(inflow - outflow)
        inflow_samples.append(inflow)

    th = cfg.section("thresholds")
    essentials = int(th["essentials_per_day_paisa"])
    min_contrib = int(th.get("min_goal_monthly_contribution_paisa", 50000))

    if not surplus_samples:
        surplus_samples = [min_contrib * 2]
        inflow_samples = [min_contrib * 5]

    surplus_arr = np.array(surplus_samples, dtype=np.int64)
    inflow_arr = np.array(inflow_samples, dtype=np.int64)

    # Fee leakage per month
    fee_sum = sum(t.fee_paisa for t in txns)
    n_months = max(len(totals), 1)
    monthly_fee = fee_sum // n_months

    max_safe = max(int(np.mean(surplus_arr)), min_contrib)

    planner_cfg = PlannerConfig(
        n_simulations=int(cfg.section("planner").get("n_simulations", 1000)),
        horizon_cap_months=int(cfg.section("planner").get("horizon_cap_months", 36)),
        min_monthly_contribution_paisa=min_contrib,
        likely_cutoff=float(cfg.section("planner").get("likely_cutoff", 0.70)),
        uncertain_cutoff=float(cfg.section("planner").get("uncertain_cutoff", 0.40)),
        # Platt recalibration — see config/app.yaml planner section (T6 back-test)
        calibration_a=float(cfg.section("planner").get("calibration_a", -2.4133)),
        calibration_b=float(cfg.section("planner").get("calibration_b", 0.5291)),
    )

    rng = np.random.default_rng(20261003)
    plan = plan_goal(
        target_paisa=target_paisa,
        months=months,
        monthly_surplus_samples_paisa=surplus_arr,
        monthly_inflow_samples_paisa=inflow_arr,
        monthly_fee_leakage_paisa=monthly_fee,
        monthly_avoidable_paisa=monthly_fee // 2,
        max_safe_contribution_paisa=max_safe,
        config=planner_cfg,
        rng=rng,
        as_of_date=origin,
    )

    options_out = []
    for opt in plan.options:
        title_bn = {
            "extend_timeline": "সময় বাড়িয়ে সহজে সঞ্চয়",
            "trim_leakage": "অপ্রয়োজনীয় ফি কমিয়ে সঞ্চয়",
            "percent_of_inflow": "প্রতি আয়ের নির্দিষ্ট অংশ সঞ্চয়",
        }.get(opt.key, opt.key)
        title_en = {
            "extend_timeline": "Extend Timeline",
            "trim_leakage": "Redirect Avoidable Fees",
            "percent_of_inflow": "Save Percentage of Inflows",
        }.get(opt.key, opt.key)

        options_out.append(
            GoalPlanOptionOut(
                key=opt.key,
                title_bn=title_bn,
                title_en=title_en,
                monthly_contribution_paisa=opt.monthly_contribution_paisa,
                monthly_contribution_display=format_taka(opt.monthly_contribution_paisa, "bn"),
                percent_of_inflow=opt.percent_of_inflow,
                months=opt.months,
                p_goal_met=opt.p_goal_met,
                p_goal_met_display=format_probability(opt.p_goal_met, "bn"),
                p_low=opt.p_low,
                p_high=opt.p_high,
                tradeoff_bn=opt.tradeoff_bn,
                tradeoff_en=opt.tradeoff_en,
            )
        )

    data = GoalPlanData(
        target_paisa=plan.target_paisa,
        target_display=format_taka(plan.target_paisa, "bn"),
        requested_months=plan.requested_months,
        monthly_required_paisa=plan.monthly_required_paisa,
        monthly_required_display=format_taka(plan.monthly_required_paisa, "bn"),
        p_requested=plan.p_requested,
        p_requested_display=format_probability(plan.p_requested, "bn"),
        verdict=plan.verdict,
        options=options_out,
        feasibility_note_bn=plan.feasibility_note_bn,
        feasibility_note_en=plan.feasibility_note_en,
    )

    evidence = build_evidence(
        cfg,
        n_transactions=len(txns),
        labels={
            "target": "Data",
            "options": "Prediction",
            "feasibility": "Prediction",
        },
        forecast_version=load_latest_version(),
    )

    return data, evidence
