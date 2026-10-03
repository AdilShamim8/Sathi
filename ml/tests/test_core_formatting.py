"""Formatting tests, including Bengali digits."""
import datetime as dt

from core.formatting import (
    format_date,
    format_probability,
    format_taka,
    to_bangla_digits,
    to_english_digits,
)


def test_format_taka_latin():
    # 3_000_000 paisa = ৳30,000 with Indian grouping.
    assert format_taka(3_000_000, "en") == "৳30,000"
    assert format_taka(100, "en") == "৳1"
    assert format_taka(12_345_678_900, "en") == "৳12,34,56,789"  # Indian grouping of 123456789
    assert format_taka(-250_000, "en") == "-৳2,500"


def test_format_taka_bangla():
    assert format_taka(3_000_000, "bn") == "৳৩০,০০০"
    assert format_taka(100, "bn") == "৳১"


def test_format_probability():
    assert format_probability(0.62, "en") == "62%"
    assert format_probability(0.62, "bn") == "৬২%"
    assert format_probability(0.655, "en") == "66%"  # half up


def test_digit_conversion_roundtrip():
    assert to_bangla_digits("০১২৩৪৫৬৭৮৯".translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))) == "০১২৩৪৫৬৭৮৯"
    assert to_english_digits("৩০,০০০") == "30,000"


def test_format_date():
    d = dt.date(2026, 9, 30)
    assert format_date(d, "bn") == "৩০ সেপ্টেম্বর ২০২৬"
    assert format_date(d, "en") == "30 Sep 2026"
