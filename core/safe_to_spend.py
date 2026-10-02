"""Safe-to-spend core decision engine. Pure function.

Computes the customer's safe spending ceiling:
  Safe-to-Spend = Total Liquid Float - (Upcoming Commitments + Safety Buffer + Prorated Savings)

The customer sees a definitive, reliable figure: "এখন আনুমানিক ৳X safe-to-spend".
"""
from __future__ import annotations

from dataclasses import dataclass

from core.formatting import format_taka


@dataclass(frozen=True)
class SafeToSpendResult:
    safe_to_spend_total_paisa: int
    safe_to_spend_total_display: str
    safe_to_spend_wallet_paisa: int
    safe_to_spend_wallet_display: str
    daily_safe_budget_paisa: int
    daily_safe_budget_display: str
    upcoming_commitments_paisa: int
    upcoming_commitments_display: str
    safety_buffer_paisa: int
    safety_buffer_display: str
    estimated_cash_paisa: int
    estimated_cash_display: str
    wallet_balance_paisa: int
    wallet_balance_display: str
    status: str  # "comfortable" | "cautious" | "tight" | "deficit"
    status_label_bn: str
    status_label_en: str
    horizon_days: int
    advice_bn: str
    advice_en: str


def calculate_safe_to_spend(
    wallet_balance_paisa: int,
    estimated_cash_paisa: int,
    upcoming_commitments_paisa: int,
    daily_essential_paisa: int,
    horizon_days: int = 14,
    monthly_savings_target_paisa: int = 0,
) -> SafeToSpendResult:
    """Compute safe-to-spend amount and daily budget for the horizon window."""
    total_liquid_paisa = max(0, wallet_balance_paisa) + max(0, estimated_cash_paisa)
    # Reserve at least 3 days of essentials as emergency cushion
    safety_buffer_paisa = max(daily_essential_paisa * 3, 100_000)  # min ৳1,000 safety reserve
    prorated_savings_paisa = int(monthly_savings_target_paisa * (horizon_days / 30.0))

    protected_obligations_paisa = (
        upcoming_commitments_paisa + safety_buffer_paisa + prorated_savings_paisa
    )

    safe_total_paisa = max(0, total_liquid_paisa - protected_obligations_paisa)
    safe_wallet_paisa = max(0, wallet_balance_paisa - protected_obligations_paisa)
    daily_budget_paisa = int(safe_total_paisa / max(horizon_days, 1))

    # Evaluate status
    if total_liquid_paisa < protected_obligations_paisa:
        status = "deficit"
        status_label_bn = "ঘাটতির ঝুঁকি"
        status_label_en = "Deficit Risk"
        advice_bn = f"সামনের {horizon_days} দিনে আবশ্যক বিল ও খরচের তুলনায় তহবিলের ঘাটতি হতে পারে। অপ্রয়োজনীয় খরচ স্থগিত রাখুন।"
        advice_en = f"Upcoming obligations exceed available funds in the next {horizon_days} days. Defer discretionary spending."
    elif safe_total_paisa < (daily_essential_paisa * 2):
        status = "tight"
        status_label_bn = "টানাটানি"
        status_label_en = "Tight"
        advice_bn = f"সামনের {horizon_days} দিনে খরচের হাত টান রাখুন। নিরাপদ ব্যয়ের সীমা খুবই সীমিত।"
        advice_en = f"Spending capacity is narrow over the next {horizon_days} days. Stick to essentials."
    elif safe_total_paisa < (daily_essential_paisa * 7):
        status = "cautious"
        status_label_bn = "সতর্কতামূলক"
        status_label_en = "Cautious"
        advice_bn = f"দৈনিক সর্বোচ্চ {format_taka(daily_budget_paisa, 'bn')} খরচ করলে আগামী {horizon_days} দিন কোনো টানাপোড়েন ছাড়াই চলবে।"
        advice_en = f"Spending up to {format_taka(daily_budget_paisa, 'en')}/day maintains full financial stability."
    else:
        status = "comfortable"
        status_label_bn = "স্বস্তিদায়ক"
        status_label_en = "Comfortable"
        advice_bn = f"আপনার তহবিল স্বাভাবিক। আসন্ন সব দায়দেনা মিটিয়েও প্রায় {format_taka(safe_total_paisa, 'bn')} ব্যয়ের সামর্থ্য রয়েছে।"
        advice_en = f"Comfortable liquidity. You have approximately {format_taka(safe_total_paisa, 'en')} available after all upcoming obligations."

    return SafeToSpendResult(
        safe_to_spend_total_paisa=safe_total_paisa,
        safe_to_spend_total_display=format_taka(safe_total_paisa, "bn"),
        safe_to_spend_wallet_paisa=safe_wallet_paisa,
        safe_to_spend_wallet_display=format_taka(safe_wallet_paisa, "bn"),
        daily_safe_budget_paisa=daily_budget_paisa,
        daily_safe_budget_display=format_taka(daily_budget_paisa, "bn"),
        upcoming_commitments_paisa=upcoming_commitments_paisa,
        upcoming_commitments_display=format_taka(upcoming_commitments_paisa, "bn"),
        safety_buffer_paisa=safety_buffer_paisa,
        safety_buffer_display=format_taka(safety_buffer_paisa, "bn"),
        estimated_cash_paisa=estimated_cash_paisa,
        estimated_cash_display=format_taka(estimated_cash_paisa, "bn"),
        wallet_balance_paisa=wallet_balance_paisa,
        wallet_balance_display=format_taka(wallet_balance_paisa, "bn"),
        status=status,
        status_label_bn=status_label_bn,
        status_label_en=status_label_en,
        horizon_days=horizon_days,
        advice_bn=advice_bn,
        advice_en=advice_en,
    )
