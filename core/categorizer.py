"""Rules-based transaction categorizer with a reason trace for every result.

No classifier is trained on these labels: on rule-generated synthetic data a
classifier would learn the rules themselves (ADR-11), which is circular.
"""
from __future__ import annotations

from core.schemas import Category, CategoryResult, Txn, TxnType

_REASONS: dict[Category, tuple[str, str]] = {
    Category.SALARY: ("বেতন হিসেবে এসেছে", "Arrived as salary"),
    Category.REMITTANCE: ("রেমিট্যান্স হিসেবে এসেছে", "Arrived as remittance"),
    Category.TRANSFER_IN: ("ওয়ালেটে টাকা এসেছে", "Money received into the wallet"),
    Category.RENT: ("ভাড়ার কাউন্টারপার্টি", "Counterparty is tagged as rent"),
    Category.BILLS: ("ইউটিলিটি বিল", "Utility bill payment"),
    Category.MOBILE: ("মোবাইল রিচার্জ", "Mobile recharge"),
    Category.FAMILY: ("পরিবারে টাকা পাঠানো", "Money sent to family"),
    Category.FOOD: ("খাবারের দোকান/মুদি মার্চেন্ট", "Food or grocery merchant"),
    Category.TRANSPORT: ("যাতায়াত খরচের মার্চেন্ট", "Transport merchant"),
    Category.BUSINESS: ("ব্যবসায়িক লেনদেন", "Business transaction"),
    Category.CASH_OUT: ("এজেন্ট থেকে ক্যাশ-আউট", "Cash withdrawal at an agent"),
    Category.OTHER: ("অন্য কোনো নিয়মে পড়েনি", "No other rule matched"),
}


def categorize(txn: Txn) -> CategoryResult:
    """One deterministic rule chain; returns the category plus the rule that fired."""
    cat: Category
    rule: str
    if txn.type == TxnType.SALARY_IN:
        cat, rule = Category.SALARY, "type:salary_in"
    elif txn.type == TxnType.REMITTANCE_IN:
        cat, rule = Category.REMITTANCE, "type:remittance_in"
    elif txn.type == TxnType.CASH_IN:
        cat, rule = Category.TRANSFER_IN, "type:cash_in"
    elif txn.type == TxnType.CASH_OUT:
        cat, rule = Category.CASH_OUT, "type:cash_out"
    elif txn.type == TxnType.BILL_PAY:
        cat, rule = Category.BILLS, "type:bill_pay"
    elif txn.type == TxnType.RECHARGE:
        cat, rule = Category.MOBILE, "type:recharge"
    elif txn.type == TxnType.SEND_MONEY:
        cp = txn.counterparty_category
        if cp == "rent":
            cat, rule = Category.RENT, "send_money:cp=rent"
        elif cp == "business":
            cat, rule = Category.BUSINESS, "send_money:cp=business"
        else:
            cat, rule = Category.FAMILY, "send_money:default_family"
    elif txn.type == TxnType.PAYMENT:
        cp = txn.counterparty_category
        if cp in (Category.FOOD.value, Category.TRANSPORT.value, Category.BUSINESS.value):
            cat, rule = Category(cp), f"payment:cp={cp}"
        else:
            cat, rule = Category.OTHER, "payment:default_other"
    else:
        cat, rule = Category.OTHER, "fallback"
    reason_bn, reason_en = _REASONS[cat]
    return CategoryResult(category=cat, rule_id=rule, reason_bn=reason_bn, reason_en=reason_en)
