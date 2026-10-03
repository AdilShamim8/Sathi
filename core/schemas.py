"""Typed containers crossing core module boundaries. Frozen dataclasses only."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from enum import Enum


class TxnType(str, Enum):
    CASH_IN = "cash_in"
    CASH_OUT = "cash_out"
    SEND_MONEY = "send_money"
    PAYMENT = "payment"
    BILL_PAY = "bill_pay"
    RECHARGE = "recharge"
    SALARY_IN = "salary_in"
    REMITTANCE_IN = "remittance_in"


INFLOW_TYPES = {TxnType.CASH_IN, TxnType.SALARY_IN, TxnType.REMITTANCE_IN}


class Category(str, Enum):
    SALARY = "salary"
    REMITTANCE = "remittance"
    TRANSFER_IN = "transfer_in"
    RENT = "rent"
    BILLS = "bills"
    MOBILE = "mobile"
    FAMILY = "family"
    FOOD = "food"
    TRANSPORT = "transport"
    BUSINESS = "business"
    CASH_OUT = "cash_out"
    OTHER = "other"


# Essentials = what the user cannot pause. Used for buffer-days and the
# planner safety buffer. Named set, not a hidden constant.
ESSENTIAL_CATEGORIES = {Category.FOOD, Category.TRANSPORT, Category.BILLS, Category.MOBILE}


@dataclass(frozen=True)
class Txn:
    txn_id: str
    ts: dt.datetime            # timezone-aware (UTC storage)
    type: TxnType
    amount_paisa: int
    fee_paisa: int
    counterparty_id: str
    counterparty_type: str     # agent | merchant | biller | operator | person
    counterparty_category: str # rent | food | transport | ... (from counterparty table)
    counterparty_accepts_digital: bool  # merchants only; agents/persons: False
    channel: str               # app | ussd | agent
    balance_after_paisa: int

    @property
    def is_inflow(self) -> bool:
        return self.type in INFLOW_TYPES


@dataclass(frozen=True)
class CategoryResult:
    category: Category
    rule_id: str      # which rule fired (reason trace)
    reason_bn: str
    reason_en: str


@dataclass(frozen=True)
class DailyFlow:
    """Net flow series point: inflow_paisa and outflow_paisa for one Dhaka date."""
    date: dt.date
    inflow_paisa: int
    outflow_paisa: int

    @property
    def net_paisa(self) -> int:
        return self.inflow_paisa - self.outflow_paisa
