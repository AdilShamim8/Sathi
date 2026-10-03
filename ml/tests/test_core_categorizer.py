"""Categorizer rule-trace tests."""
import datetime as dt

from core.categorizer import categorize
from core.schemas import Category, Txn, TxnType
from core.timeutils import UTC


def _mk(ttype, cp_cat="food", cp_type="merchant"):
    return Txn("t", dt.datetime(2026, 9, 5, 12, tzinfo=UTC), ttype, 10_000, 0,
               "cp", cp_type, cp_cat, cp_type == "merchant", "app", 0)


def test_all_types():
    assert categorize(_mk(TxnType.SALARY_IN)).category == Category.SALARY
    assert categorize(_mk(TxnType.REMITTANCE_IN)).category == Category.REMITTANCE
    assert categorize(_mk(TxnType.CASH_IN)).category == Category.TRANSFER_IN
    assert categorize(_mk(TxnType.CASH_OUT)).category == Category.CASH_OUT
    assert categorize(_mk(TxnType.BILL_PAY)).category == Category.BILLS
    assert categorize(_mk(TxnType.RECHARGE)).category == Category.MOBILE
    assert categorize(_mk(TxnType.SEND_MONEY, "rent", "person")).category == Category.RENT
    assert categorize(_mk(TxnType.SEND_MONEY, "cousin", "person")).category == Category.FAMILY
    assert categorize(_mk(TxnType.PAYMENT, "transport")).category == Category.TRANSPORT
    assert categorize(_mk(TxnType.PAYMENT, "misc")).category == Category.OTHER


def test_reason_trace_present():
    r = categorize(_mk(TxnType.CASH_OUT, "agent", "agent"))
    assert r.rule_id == "type:cash_out"
    assert r.reason_bn and r.reason_en
