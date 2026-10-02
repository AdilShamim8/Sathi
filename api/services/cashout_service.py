"""Cashout insights service: runs core/cashout.py detector and returns formatted patterns."""
from __future__ import annotations

import sqlite3

from api.errors import NotFoundError
from api.repositories import transactions as tx_repo
from api.repositories import users as users_repo
from api.schemas.common import Evidence
from api.schemas.extended import CashoutData, CashoutPatternOut
from api.services import convert
from api.services.evidence import build_evidence
from core.cashout import detect_cashout_patterns
from core.formatting import format_probability, format_taka
from ml.inference import load_latest_version


def get_cashout_insights(conn: sqlite3.Connection, cfg, user_id: str) -> tuple[CashoutData, Evidence]:
    user = users_repo.get_user(conn, user_id)
    if user is None:
        raise NotFoundError()

    rows = tx_repo.list_for_user(conn, user_id)
    txns = [convert.row_to_txn(r) for r in rows]

    fees_cfg = cfg.section("fees")
    cash_out_bps = int(fees_cfg.get("cash_out_bps", 149))
    min_fee_paisa = int(fees_cfg.get("cash_out_min_paisa", 500))

    insights = detect_cashout_patterns(
        txns=txns,
        cash_out_bps=cash_out_bps,
        cash_out_min_fee_paisa=min_fee_paisa,
    )

    pattern_rows = []
    for p in insights.patterns:
        pattern_rows.append(
            CashoutPatternOut(
                counterparty_id=p.counterparty_id,
                count=p.count,
                total_amount_paisa=p.total_amount_paisa,
                total_amount_display=format_taka(p.total_amount_paisa, "bn"),
                total_fee_paisa=p.total_fee_paisa,
                total_fee_display=format_taka(p.total_fee_paisa, "bn"),
                replaceable_count=p.replaceable_count,
                replaceable_amount_paisa=p.replaceable_amount_paisa,
                replaceable_amount_display=format_taka(p.replaceable_amount_paisa, "bn"),
                replaceable_fee_saved_paisa=p.replaceable_fee_saved_paisa,
                replaceable_fee_saved_display=format_taka(p.replaceable_fee_saved_paisa, "bn"),
            )
        )

    data = CashoutData(
        patterns=pattern_rows,
        total_cashouts=insights.total_cashouts,
        total_fees_paisa=insights.total_fees_paisa,
        total_fees_display=format_taka(insights.total_fees_paisa, "bn"),
        replaceable_count=insights.replaceable_count,
        replaceable_amount_paisa=insights.replaceable_amount_paisa,
        replaceable_amount_display=format_taka(insights.replaceable_amount_paisa, "bn"),
        replaceable_fee_saved_paisa=insights.replaceable_fee_saved_paisa,
        replaceable_fee_saved_display=format_taka(insights.replaceable_fee_saved_paisa, "bn"),
        cash_dependency_ratio=insights.cash_dependency_ratio,
        cash_dependency_ratio_display=format_probability(insights.cash_dependency_ratio, "bn")
        if insights.cash_dependency_ratio is not None
        else None,
    )

    evidence = build_evidence(
        cfg,
        n_transactions=len(txns),
        labels={
            "replaceable_fees": "Prediction",
            "total_cashouts": "Data",
            "cash_dependency": "Data",
        },
        forecast_version=load_latest_version(),
    )

    return data, evidence
