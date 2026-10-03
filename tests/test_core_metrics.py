"""Metrics engine tests with hand-calculated values.

Fixture month (September 2026, 30 days, Asia/Dhaka):
  salary_in  ৳18,000 on the 5th
  payment    ৳200 food x 30 days              = ৳6,000
  cash_out   ৳1,000 x 5, fee ৳15 each         = ৳5,000 + ৳75
  send_money rent ৳5,000
  inflow  = 1,800,000 paisa
  outflow = 600,000 + 507,500 + 500,000 = 1,607,500 paisa
"""
import datetime as dt

from core.metrics import compute_metrics, weekly_outflows
from core.schemas import Txn, TxnType
from core.timeutils import UTC

DAY = dt.timedelta(days=1)


def _txn(i, day, ttype, amount, fee=0, cp_type="merchant", cp_cat="food", digital=True):
    return Txn(
        txn_id=f"t{i}", ts=dt.datetime(2026, 9, day, 12, 0, tzinfo=UTC),
        type=ttype, amount_paisa=amount, fee_paisa=fee,
        counterparty_id=f"cp{i % 3}", counterparty_type=cp_type,
        counterparty_category=cp_cat, counterparty_accepts_digital=digital,
        channel="app", balance_after_paisa=0,
    )


def _fixture() -> list[Txn]:
    txns = [_txn(0, 5, TxnType.SALARY_IN, 1_800_000, cp_type="person", cp_cat="employer")]
    for d in range(1, 31):
        txns.append(_txn(100 + d, d, TxnType.PAYMENT, 20_000))
    for i, d in enumerate([9, 12, 16, 20, 24]):
        txns.append(_txn(200 + i, d, TxnType.CASH_OUT, 100_000, fee=1_500, cp_type="agent", cp_cat="agent", digital=False))
    txns.append(_txn(300, 6, TxnType.SEND_MONEY, 500_000, cp_type="person", cp_cat="rent"))
    return txns


def test_metrics_hand_calculated():
    m = compute_metrics(_fixture(), balance_paisa=100_000, as_of_date=dt.date(2026, 9, 30), essentials_per_day_paisa=35_000)
    # savings_rate = (1,800,000 - 1,607,500) / 1,800,000 = 0.106944...
    assert abs(m.savings_rate - 192_500 / 1_800_000) < 1e-9
    # cash_dependency = 507,500 / 1,607,500
    assert abs(m.cash_dependency_ratio - 507_500 / 1_607_500) < 1e-9
    # fee_leakage = 7,500 / 1,607,500
    assert abs(m.fee_leakage - 7_500 / 1_607_500) < 1e-9
    # buffer: essential spend (food) = 600,000/30 = 20,000/day < 35,000
    # threshold, so divisor is the threshold: 100,000 / 35,000 = 2.8571...
    assert abs(m.buffer_days - 100_000 / 35_000) < 1e-6
    assert m.n_transactions == 37
    assert m.window_days == 30


def test_metrics_empty_history():
    m = compute_metrics([], balance_paisa=0, as_of_date=dt.date(2026, 9, 30), essentials_per_day_paisa=35_000)
    assert m.n_transactions == 0 and m.savings_rate is None


def test_weekly_outflows_flags_largest():
    weeks = weekly_outflows(_fixture())
    assert weeks, "expected weekly buckets"
    largest = [w for w in weeks if w.is_largest]
    assert len(largest) == 1
    assert largest[0].outflow_paisa == max(w.outflow_paisa for w in weeks)
