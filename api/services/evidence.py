"""Builds the evidence block attached to every insight-bearing response.

Values come from config and the model metadata — never hand-written at the
call site (architecture §7.1, invariant 14).
"""
from __future__ import annotations

import datetime as dt

from api.schemas.common import (AssumptionNote, DataUsed, Evidence,
                                ModelVersions, ValidatorInfo)
from core.formatting import format_taka


def build_evidence(cfg, n_transactions: int, labels: dict[str, str],
                   forecast_version: str, *,
                   generated_text: bool = False,
                   prompt_version: str | None = None,
                   validator_passed: bool = True,
                   fallback_used: bool = False,
                   extra_assumptions: list[AssumptionNote] | None = None) -> Evidence:
    ds = cfg.section("dataset")
    fees = cfg.section("fees")
    th = cfg.section("thresholds")
    as_of = ds["as_of_date"]
    window = f'{ds["start_date"]}…{as_of}'
    assumptions = [
        AssumptionNote(id="FEE_CASHOUT_RATE",
                       value=f'{fees["cash_out_bps"]} bps, min {format_taka(int(fees["cash_out_min_paisa"]), "en")}'),
        AssumptionNote(id="FEE_DIGITAL_PAYMENT_RATE",
                       value=f'{fees["digital_payment_bps"]} bps'),
        AssumptionNote(id="ESSENTIALS_PER_DAY",
                       value=format_taka(int(th["essentials_per_day_paisa"]), "en")),
        AssumptionNote(id="SHORTFALL_HORIZON_DAYS",
                       value=str(th["shortfall_horizon_days"])),
    ]
    if extra_assumptions:
        assumptions.extend(extra_assumptions)
    return Evidence(
        data_used=DataUsed(window=window, as_of_date=as_of, n_transactions=n_transactions),
        model_version=ModelVersions(forecast=forecast_version),
        config_hash=cfg.config_hash,
        assumptions=assumptions,
        labels=labels,  # type: ignore[arg-type]  (pydantic validates the Literal)
        generated_text=generated_text,
        prompt_version=prompt_version,
        validator=ValidatorInfo(passed=validator_passed, fallback_used=fallback_used),
    )


def as_of_date(cfg) -> dt.date:
    """"Today" is dataset.as_of_date — never wall-clock (ADR-10)."""
    return dt.date.fromisoformat(cfg.section("dataset")["as_of_date"])
