import datetime as dt
from core.cash_on_hand import estimate_cash_on_hand
from core.recurring import detect_recurring_patterns
from core.safe_to_spend import calculate_safe_to_spend
from core.schemas import Txn, TxnType
from ml.benchmark import load_benchmark_metrics


def test_safe_to_spend_basic():
    # ৳15,000 balance, ৳2,000 cash on hand, ৳4,000 upcoming bills, ৳500/day essentials
    res = calculate_safe_to_spend(
        wallet_balance_paisa=1_500_000,
        estimated_cash_paisa=200_000,
        upcoming_commitments_paisa=400_000,
        daily_essential_paisa=50_000,
        horizon_days=14,
    )
    # Total liquid = ৳17,000
    # Protected = ৳4,000 bills + ৳1,500 safety reserve (3 * ৳500) = ৳5,500
    # Safe to spend = ৳17,000 - ৳5,500 = ৳11,500
    assert res.safe_to_spend_total_paisa == 1_150_000
    assert res.status == "comfortable"
    assert res.daily_safe_budget_paisa == int(1_150_000 / 14)


def test_safe_to_spend_deficit():
    # Only ৳1,000 balance, but ৳5,000 bill due
    res = calculate_safe_to_spend(
        wallet_balance_paisa=100_000,
        estimated_cash_paisa=0,
        upcoming_commitments_paisa=500_000,
        daily_essential_paisa=50_000,
        horizon_days=14,
    )
    assert res.safe_to_spend_total_paisa == 0
    assert res.status == "deficit"


def test_cash_on_hand_decay():
    as_of = dt.date(2026, 10, 2)
    # Cashout 3 days ago of ৳2,000
    t1 = Txn(
        txn_id="tx1",
        ts=dt.datetime(2026, 9, 29, 12, 0, tzinfo=dt.timezone.utc),
        type=TxnType.CASH_OUT,
        channel="ussd",
        amount_paisa=200_000,
        fee_paisa=2_980,
        counterparty_id="ag1",
        counterparty_type="agent",
        counterparty_category="cash_agent",
        counterparty_accepts_digital=False,
        balance_after_paisa=50_000,
    )
    est = estimate_cash_on_hand([t1], as_of, decay_days=7)
    # 4 days remaining out of 7 -> fraction = 4/7 ~ 57%
    assert est.estimated_cash_paisa > 0
    assert est.estimated_cash_paisa < 200_000
    assert est.trailing_cashout_total_paisa == 200_000


def test_benchmark_metrics():
    metrics = load_benchmark_metrics()
    assert "brier_score" in metrics
    assert metrics["brier_score"]["brier_skill_score"] > 0
    assert "early_warning_7d" in metrics
    assert metrics["early_warning_7d"]["ml_f1"] > metrics["early_warning_7d"]["baseline_f1"]
