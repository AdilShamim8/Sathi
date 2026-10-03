"""Cash-out detector tests: repeat agents, replaceability, fee math."""
import datetime as dt

from core.cashout import detect_cashout_patterns
from core.money import apply_rate
from core.schemas import Txn, TxnType
from core.timeutils import UTC

RATE_BPS = 150  # 1.5%
MIN_FEE = 500


def _co(i, day, agent="agentA", amount=100_000):
    fee = apply_rate(amount, RATE_BPS, MIN_FEE)
    return Txn(f"co{i}", dt.datetime(2026, 9, day, 10, tzinfo=UTC), TxnType.CASH_OUT,
               amount, fee, agent, "agent", "agent", False, "agent", 0)


def _pay(i, day, amount=60_000, digital=True):
    return Txn(f"p{i}", dt.datetime(2026, 9, day, 18, tzinfo=UTC), TxnType.PAYMENT,
               amount, 0, f"m{i}", "merchant", "food", digital, "app", 0)


def test_repeat_agent_and_replaceability():
    txns = [
        _co(1, 5), _pay(1, 6),          # replaceable: payment next day >= 50%
        _co(2, 10), _pay(2, 11),
        _co(3, 15),                     # not followed by any payment
        _co(4, 20, agent="agentB"),     # different agent, only once
        _pay(9, 21, digital=False),     # cash-only merchant: does not count
    ]
    ins = detect_cashout_patterns(txns, RATE_BPS, MIN_FEE, min_repeat=3, follow_days=2)
    assert ins.total_cashouts == 4
    # Only agentA forms a pattern (3 >= min_repeat); agentB has 1.
    assert len(ins.patterns) == 1
    pat = ins.patterns[0]
    assert pat.counterparty_id == "agentA"
    assert pat.count == 3
    assert pat.replaceable_count == 2
    # Fee saved = 150 bps on 2 x 100_000 = 2 x 1_500 = 3_000.
    assert pat.replaceable_fee_saved_paisa == 3_000
    assert ins.total_fees_paisa == 4 * 1_500


def test_no_patterns_when_below_min_repeat():
    txns = [_co(1, 5), _co(2, 10)]
    ins = detect_cashout_patterns(txns, RATE_BPS, MIN_FEE, min_repeat=3)
    assert ins.patterns == [] and ins.total_cashouts == 2


def test_cash_dependency_ratio():
    txns = [_co(1, 5), _pay(1, 6, amount=100_000)]
    ins = detect_cashout_patterns(txns, RATE_BPS, MIN_FEE)
    # outflow = (100_000+1_500) + 100_000; cash-out share = 101_500/201_500
    assert abs(ins.cash_dependency_ratio - 101_500 / 201_500) < 1e-9
