"""Cash-out pattern detector (P1): repeat agent withdrawals that could
plausibly have been digital payments, with the fee impact.

Replaceability signal: a cash-out followed within `follow_days` by a payment
to a merchant that accepts digital, of at least `min_amount_frac` of the
withdrawn amount. The fee math uses the configurable rate in config/fees.yaml
(shown to the user as a labelled Assumption).
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

from core.money import apply_rate
from core.schemas import Txn, TxnType
from core.timeutils import dhaka_date


@dataclass(frozen=True)
class CashoutPattern:
    counterparty_id: str
    count: int                     # cash-outs to this agent in the window
    total_amount_paisa: int
    total_fee_paisa: int
    replaceable_count: int         # followed by a digital-capable payment
    replaceable_amount_paisa: int
    replaceable_fee_saved_paisa: int  # fees avoidable at the configured rate


@dataclass(frozen=True)
class CashoutInsights:
    patterns: list[CashoutPattern]
    total_cashouts: int
    total_fees_paisa: int
    replaceable_count: int
    replaceable_amount_paisa: int
    replaceable_fee_saved_paisa: int
    cash_dependency_ratio: float | None


def detect_cashout_patterns(
    txns: list[Txn],
    cash_out_bps: int,
    cash_out_min_fee_paisa: int,
    min_repeat: int = 3,
    follow_days: int = 2,
    min_amount_frac: float = 0.5,
) -> CashoutInsights:
    """Find repeat cash-out agents and how many withdrawals were replaceable.

    Defaults are documented ASSUMPTIONs (docs/assumptions.md), passed in by
    the caller from config — nothing is hardcoded at point of use.
    """
    cashouts = [t for t in txns if t.type == TxnType.CASH_OUT]
    payments = [
        t for t in txns
        if t.type == TxnType.PAYMENT and t.counterparty_type == "merchant" and t.counterparty_accepts_digital
    ]
    outflow_total = sum(t.amount_paisa + t.fee_paisa for t in txns if not t.is_inflow)

    # Payment days by nothing finer than date: a payment "uses" the withdrawn
    # cash if it happens within follow_days after the withdrawal.
    payment_index: list[tuple[dt.date, int]] = sorted(
        (dhaka_date(p.ts), p.amount_paisa) for p in payments
    )

    def replaceable(co: Txn) -> bool:
        d = dhaka_date(co.ts)
        for pd, amount in payment_index:
            delta = (pd - d).days
            if delta < 0:
                continue
            if delta > follow_days:
                break
            if amount >= int(co.amount_paisa * min_amount_frac):
                return True
        return False

    by_agent: dict[str, list[Txn]] = {}
    for co in cashouts:
        by_agent.setdefault(co.counterparty_id, []).append(co)

    patterns: list[CashoutPattern] = []
    total_replaceable_count = 0
    total_replaceable_amount = 0
    total_replaceable_fee = 0
    for agent_id in sorted(by_agent):
        group = by_agent[agent_id]
        if len(group) < min_repeat:
            continue
        rep = [co for co in group if replaceable(co)]
        rep_fee = sum(
            apply_rate(co.amount_paisa, cash_out_bps, cash_out_min_fee_paisa) for co in rep
        )
        patterns.append(CashoutPattern(
            counterparty_id=agent_id,
            count=len(group),
            total_amount_paisa=sum(co.amount_paisa for co in group),
            total_fee_paisa=sum(co.fee_paisa for co in group),
            replaceable_count=len(rep),
            replaceable_amount_paisa=sum(co.amount_paisa for co in rep),
            replaceable_fee_saved_paisa=rep_fee,
        ))
        total_replaceable_count += len(rep)
        total_replaceable_amount += sum(co.amount_paisa for co in rep)
        total_replaceable_fee += rep_fee

    total_fees = sum(co.fee_paisa for co in cashouts)
    cash_dep = (
        sum(co.amount_paisa + co.fee_paisa for co in cashouts) / outflow_total
        if outflow_total > 0 else None
    )
    return CashoutInsights(
        patterns=patterns,
        total_cashouts=len(cashouts),
        total_fees_paisa=total_fees,
        replaceable_count=total_replaceable_count,
        replaceable_amount_paisa=total_replaceable_amount,
        replaceable_fee_saved_paisa=total_replaceable_fee,
        cash_dependency_ratio=cash_dep,
    )
