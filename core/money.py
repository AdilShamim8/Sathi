"""Money arithmetic. Integer paisa only; rates are integer basis points.

The single rounding function is apply_rate (half up to the nearest paisa).
"""

BASIS_POINTS_PER_UNIT = 10_000  # 100 bps = 1%


def apply_rate(amount_paisa: int, rate_bps: int, min_fee_paisa: int = 0) -> int:
    """Fee for `amount_paisa` at `rate_bps` basis points, rounded half up.

    Hand-check: ৳1,000 = 100_000 paisa at 150 bps (1.5%)
    -> 100_000 * 150 / 10_000 = 1_500 paisa = ৳15.00.
    """
    if amount_paisa < 0 or rate_bps < 0:
        raise ValueError("amount_paisa and rate_bps must be non-negative")
    # Half-up rounding on integers: (2*x + d) // (2*d) is exact and safe.
    num = amount_paisa * rate_bps
    fee = (2 * num + BASIS_POINTS_PER_UNIT) // (2 * BASIS_POINTS_PER_UNIT)
    if fee > 0 and fee < min_fee_paisa:
        return min_fee_paisa
    return fee


def taka_to_paisa(taka: float) -> int:
    """Convert a taka figure to paisa, rounding half up. Input to engines only."""
    if taka < 0:
        raise ValueError("taka must be non-negative")
    return int(taka * 100 + 0.5)
