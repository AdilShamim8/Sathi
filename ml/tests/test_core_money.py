"""Hand-calculated money tests."""
import pytest

from core.money import apply_rate, taka_to_paisa


def test_apply_rate_150bps_on_1000_taka():
    # ৳1,000 = 100_000 paisa at 150 bps (1.5%): 100_000 * 150 / 10_000 = 1_500.
    assert apply_rate(100_000, 150) == 1_500


def test_apply_rate_half_up_rounding():
    # 150 bps on ৳3.33 = 333 paisa: 333*150/10000 = 4.995 -> 5 (half up).
    assert apply_rate(333, 150) == 5
    # 100 paisa at 150 bps = 1.5 -> 2 (half up).
    assert apply_rate(100, 150) == 2


def test_apply_rate_min_fee():
    # ৳100 at 1.5% = ৳1.50 raw, but the minimum fee is ৳5.00.
    assert apply_rate(10_000, 150, min_fee_paisa=500) == 500
    # Zero fee stays zero (min fee only applies to a positive fee).
    assert apply_rate(0, 150, min_fee_paisa=500) == 0


def test_apply_rate_rejects_negative():
    with pytest.raises(ValueError):
        apply_rate(-1, 150)


def test_taka_to_paisa():
    assert taka_to_paisa(30_000) == 3_000_000
    assert taka_to_paisa(0.5) == 50
