"""Summary service: composes core metrics + categorizer + reviewed templates.

No financial math here beyond aggregation and display formatting — the
numbers come from core/metrics.py and the strings from llm/templates/.
"""
from __future__ import annotations

import sqlite3

from api.repositories import transactions as tx_repo
from api.repositories import users as users_repo
from api.schemas.me import (CategoryRow, Insight, MetricsOut, SummaryData,
                            UserRef)
from api.services import convert
from api.services.evidence import as_of_date, build_evidence
from api.schemas.common import Evidence
from core.categorizer import categorize
from core.formatting import format_date, format_probability, format_taka, to_bangla_digits
from core.metrics import compute_metrics, monthly_totals, weekly_outflows
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

    # Insights from reviewed templates. Every figure is preformatted here.
    insights: list[Insight] = []
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
    if metrics.fee_leakage and metrics.fee_leakage > 0:
        pass  # ratio lives in metrics; the taka total below is the insight
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

    data = SummaryData(
        user=UserRef(persona=user["persona"],
                     persona_label_bn=persona_cfg["label_bn"],
                     persona_label_en=persona_cfg["label_en"]),
        as_of_date=as_of.isoformat(),
        balance_paisa=balance,
        balance_display=format_taka(balance, "bn"),
        confidence=confidence,
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
        "monthly_income": "Data",
        "monthly_spend": "Data",
        "categories": "Data",
        "insights": "Data",
        "fee_rate": "Assumption",
    }, forecast_version)
    return data, evidence
