"""Summary service: composes core metrics + categorizer + safe-to-spend + cash-on-hand.

No financial math here beyond aggregation and display formatting — the
numbers come from pure core/ functions and strings from llm/templates/.
"""
from __future__ import annotations

import sqlite3

from api.repositories import transactions as tx_repo
from api.repositories import users as users_repo
from api.schemas.common import Evidence
from api.schemas.me import (
    CashOnHandOut,
    CategoryRow,
    Insight,
    MetricsOut,
    RecurringItemOut,
    RecurringSummaryOut,
    SafeToSpendOut,
    SummaryData,
    UserRef,
)
from api.services import convert
from api.services.evidence import as_of_date, build_evidence
from api.services.forecast_service import user_forecast
from core.cash_on_hand import estimate_cash_on_hand
from core.categorizer import categorize
from core.formatting import format_date, format_probability, format_taka, to_bangla_digits
from core.metrics import compute_metrics, monthly_totals, weekly_outflows
from core.recurring import detect_recurring_patterns
from core.safe_to_spend import model_status, safe_to_spend_rule
from llm.render import render


def _category_labels(cfg) -> dict[str, dict[str, str]]:
    sec = cfg.section("categories")
    return sec.get("categories", sec)


def _fmt_pct(value: float | None, locale: str) -> str | None:
    return None if value is None else format_probability(value, locale)


def _fmt_days(value: float | None, locale: str) -> str | None:
    if value is None:
        return None
    rounded = str(int(value + 0.5))
    return to_bangla_digits(rounded) if locale == "bn" else rounded


def get_summary(conn: sqlite3.Connection, cfg, forecast_version: str,
                user_id: str) -> tuple[SummaryData, Evidence]:
    user = users_repo.get_user(conn, user_id)
    if user is None:
        from api.errors import NotFoundError
        raise NotFoundError()
    rows = tx_repo.list_for_user(conn, user_id)
    txns = [convert.row_to_txn(r) for r in rows]
    as_of = as_of_date(cfg)
    essentials = int(cfg.section("thresholds")["essentials_per_day_paisa"])
    balance = txns[-1].balance_after_paisa if txns else 0
    metrics = compute_metrics(txns, balance, as_of, essentials)
    personas = cfg.section("personas")
    persona_cfg = personas[user["persona"]]
    labels = _category_labels(cfg)

    th = cfg.section("thresholds")
    confidence = "low" if (metrics.n_transactions < int(th["min_history_transactions"])
                           or metrics.window_days < int(th["min_history_days"])) else "normal"

    # Dynamic Recurring obligations detection directly from transaction patterns
    rec_summary = detect_recurring_patterns(txns, as_of)

    # Physical Cash-on-Hand estimation from recent cash-outs
    coh_estimate = estimate_cash_on_hand(txns, as_of)

    # Core Safe-to-Spend output
    s2s = safe_to_spend_rule(
        wallet_balance_paisa=balance,
        estimated_cash_paisa=coh_estimate.estimated_cash_paisa,
        upcoming_commitments_paisa=rec_summary.upcoming_commitments_14d_paisa,
        daily_essential_paisa=essentials,
        horizon_days=14,
        monthly_savings_target_paisa=0,
    )

    # Categories: outflow totals per category (the "where does money go" view).
    totals: dict[str, int] = {}
    outflow_sum = 0
    for t in txns:
        if t.is_inflow:
            continue
        cat = categorize(t).category.value
        amount = t.amount_paisa + t.fee_paisa
        totals[cat] = totals.get(cat, 0) + amount
        outflow_sum += amount
    categories = [
        CategoryRow(
            category=cat,
            label_bn=labels[cat]["label_bn"],
            label_en=labels[cat]["label_en"],
            total_paisa=total,
            total_display=format_taka(total, "bn"),
            share=(total / outflow_sum) if outflow_sum else 0.0,
            share_display=format_probability((total / outflow_sum) if outflow_sum else 0.0, "bn"),
        )
        for cat, total in sorted(totals.items(), key=lambda kv: -kv[1])
    ]

    # Model-based safe-to-spend (ML): Q_0.10 of the simulated minimum wallet
    # balance before the next income, minus the personal floor. The rule
    # value above is kept alongside as the baseline.
    fc = user_forecast(conn, cfg, user_id)
    if fc is not None:
        safe_total = fc.safe_to_spend_paisa
        window = fc.window_days
        status, label_bn, label_en, advice_bn, advice_en = model_status(
            safe_total, essentials, fc.p_shortfall)
        method = "model"
    else:
        safe_total, window = s2s.safe_to_spend_total_paisa, s2s.horizon_days
        status, label_bn, label_en = s2s.status, s2s.status_label_bn, s2s.status_label_en
        advice_bn, advice_en, method = s2s.advice_bn, s2s.advice_en, "rule"
    daily_budget = int(safe_total / max(window, 1))
    safe_display = format_taka(safe_total, "bn")
    daily_display = format_taka(daily_budget, "bn")

    # Insights from reviewed templates. Every figure is preformatted here.
    insights: list[Insight] = []
    # Safe to spend primary insight
    insights.append(Insight(
        id="safe_to_spend",
        label="Prediction" if method == "model" else "Data",
        text_bn=f"পরবর্তী আয়ের আগ পর্যন্ত নিয়মিত বিল ও সম্ভাব্য খরচ হিসাব করে আপনার নিরাপদ ব্যয়ের সীমা প্রায় {safe_display} (দৈনিক {daily_display})।",
        text_en=f"Accounting for upcoming bills and likely spending until your next income, your safe-to-spend limit is {format_taka(safe_total, 'en')} (~{format_taka(daily_budget, 'en')}/day).",
    ))

    months = monthly_totals(txns)
    if months:
        last_month = max(months)
        inc, out = months[last_month]
        insights.append(Insight(
            id="income_spend", label="Data",
            text_bn=render("summary_income_spend", "bn",
                           income=format_taka(inc, "bn"), spend=format_taka(out, "bn")),
            text_en=render("summary_income_spend", "en",
                           income=format_taka(inc, "en"), spend=format_taka(out, "en")),
        ))
    weeks = weekly_outflows(txns)
    largest = next((w for w in weeks if w.is_largest), None)
    if largest is not None:
        insights.append(Insight(
            id="largest_week", label="Data",
            text_bn=render("summary_largest_week", "bn",
                           week_date=format_date(largest.start, "bn"),
                           amount=format_taka(largest.outflow_paisa, "bn")),
            text_en=render("summary_largest_week", "en",
                           week_date=format_date(largest.start, "en"),
                           amount=format_taka(largest.outflow_paisa, "en")),
        ))
    fee_total = sum(t.fee_paisa for t in txns if not t.is_inflow)
    if fee_total > 0:
        insights.append(Insight(
            id="fees", label="Data",
            text_bn=render("summary_fees", "bn", fees=format_taka(fee_total, "bn")),
            text_en=render("summary_fees", "en", fees=format_taka(fee_total, "en")),
        ))
    if metrics.buffer_days is not None:
        insights.append(Insight(
            id="buffer", label="Data",
            text_bn=render("summary_buffer", "bn", days=_fmt_days(metrics.buffer_days, "bn") or ""),
            text_en=render("summary_buffer", "en", days=_fmt_days(metrics.buffer_days, "en") or ""),
        ))
    if confidence == "low":
        insights.append(Insight(
            id="low_data", label="Data",
            text_bn=render("summary_low_data", "bn"),
            text_en=render("summary_low_data", "en"),
        ))

    safe_to_spend_out = SafeToSpendOut(
        safe_to_spend_total_paisa=safe_total,
        safe_to_spend_total_display=safe_display,
        safe_to_spend_wallet_paisa=s2s.safe_to_spend_wallet_paisa,
        safe_to_spend_wallet_display=s2s.safe_to_spend_wallet_display,
        daily_safe_budget_paisa=daily_budget,
        daily_safe_budget_display=daily_display,
        upcoming_commitments_paisa=s2s.upcoming_commitments_paisa,
        upcoming_commitments_display=s2s.upcoming_commitments_display,
        safety_buffer_paisa=s2s.safety_buffer_paisa,
        safety_buffer_display=s2s.safety_buffer_display,
        estimated_cash_paisa=s2s.estimated_cash_paisa,
        estimated_cash_display=s2s.estimated_cash_display,
        wallet_balance_paisa=s2s.wallet_balance_paisa,
        wallet_balance_display=s2s.wallet_balance_display,
        status=status,
        status_label_bn=label_bn,
        status_label_en=label_en,
        horizon_days=window,
        advice_bn=advice_bn,
        advice_en=advice_en,
        method=method,
        rule_safe_to_spend_paisa=s2s.safe_to_spend_total_paisa,
        rule_safe_to_spend_display=s2s.safe_to_spend_total_display,
        shortfall_prob=fc.p_shortfall if fc is not None else None,
    )

    cash_on_hand_out = CashOnHandOut(
        estimated_cash_paisa=coh_estimate.estimated_cash_paisa,
        estimated_cash_display=coh_estimate.estimated_cash_display,
        trailing_cashout_total_paisa=coh_estimate.trailing_cashout_total_paisa,
        trailing_cashout_total_display=coh_estimate.trailing_cashout_total_display,
        daily_cash_burn_paisa=coh_estimate.daily_cash_burn_paisa,
        daily_cash_burn_display=coh_estimate.daily_cash_burn_display,
        days_of_cash_remaining=coh_estimate.days_of_cash_remaining,
        confidence=coh_estimate.confidence,
        last_cashout_date=coh_estimate.last_cashout_date,
    )

    rec_out = RecurringSummaryOut(
        inflows=[
            RecurringItemOut(
                item_id=it.item_id,
                title_bn=it.title_bn,
                title_en=it.title_en,
                category=it.category,
                direction=it.direction,
                amount_paisa=it.amount_paisa,
                amount_display=it.amount_display,
                interval_days=it.interval_days,
                periodicity=it.periodicity,
                expected_day_of_month=it.expected_day_of_month,
                confidence=it.confidence,
                next_expected_date=it.next_expected_date,
                occurrence_count=it.occurrence_count,
            )
            for it in rec_summary.inflows
        ],
        outflows=[
            RecurringItemOut(
                item_id=it.item_id,
                title_bn=it.title_bn,
                title_en=it.title_en,
                category=it.category,
                direction=it.direction,
                amount_paisa=it.amount_paisa,
                amount_display=it.amount_display,
                interval_days=it.interval_days,
                periodicity=it.periodicity,
                expected_day_of_month=it.expected_day_of_month,
                confidence=it.confidence,
                next_expected_date=it.next_expected_date,
                occurrence_count=it.occurrence_count,
            )
            for it in rec_summary.outflows
        ],
        total_monthly_inflow_paisa=rec_summary.total_monthly_inflow_paisa,
        total_monthly_outflow_paisa=rec_summary.total_monthly_outflow_paisa,
        total_monthly_inflow_display=rec_summary.total_monthly_inflow_display,
        total_monthly_outflow_display=rec_summary.total_monthly_outflow_display,
        detected_salary_dom=rec_summary.detected_salary_dom,
        upcoming_commitments_14d_paisa=rec_summary.upcoming_commitments_14d_paisa,
        upcoming_commitments_14d_display=rec_summary.upcoming_commitments_14d_display,
    )

    data = SummaryData(
        user=UserRef(persona=user["persona"],
                     persona_label_bn=persona_cfg["label_bn"],
                     persona_label_en=persona_cfg["label_en"]),
        as_of_date=as_of.isoformat(),
        balance_paisa=balance,
        balance_display=format_taka(balance, "bn"),
        confidence=confidence,
        safe_to_spend=safe_to_spend_out,
        cash_on_hand=cash_on_hand_out,
        recurring=rec_out,
        metrics=MetricsOut(
            monthly_income_paisa=metrics.monthly_income_paisa,
            monthly_income_display=format_taka(metrics.monthly_income_paisa, "bn"),
            monthly_spend_paisa=metrics.monthly_spend_paisa,
            monthly_spend_display=format_taka(metrics.monthly_spend_paisa, "bn"),
            savings_rate=metrics.savings_rate,
            savings_rate_display=_fmt_pct(metrics.savings_rate, "bn"),
            income_volatility=metrics.income_volatility,
            income_volatility_display=_fmt_pct(metrics.income_volatility, "bn"),
            buffer_days=metrics.buffer_days,
            buffer_days_display=_fmt_days(metrics.buffer_days, "bn"),
            cash_dependency_ratio=metrics.cash_dependency_ratio,
            cash_dependency_ratio_display=_fmt_pct(metrics.cash_dependency_ratio, "bn"),
            fee_leakage_paisa=fee_total,
            fee_leakage_display=format_taka(fee_total, "bn"),
            fixed_commitment_ratio=metrics.fixed_commitment_ratio,
            fixed_commitment_ratio_display=_fmt_pct(metrics.fixed_commitment_ratio, "bn"),
        ),
        categories=categories,
        insights=insights,
    )
    evidence = build_evidence(cfg, metrics.n_transactions, {
        "balance": "Data",
        "safe_to_spend": "Data",
        "cash_on_hand": "Data",
        "recurring_commitments": "Data",
        "monthly_income": "Data",
        "monthly_spend": "Data",
        "categories": "Data",
        "insights": "Data",
        "fee_rate": "Assumption",
    }, forecast_version)
    return data, evidence
