"""The ONE shared formatter (invariant: UI renders `display`, never formats).

Produces both Latin and Bengali digit variants. The validator and the UI
both rely on these exact strings.
"""
from __future__ import annotations

import datetime as dt

_EN_DIGITS = "0123456789"
_BN_DIGITS = "০১২৩৪৫৬৭৮৯"
_EN_TO_BN = str.maketrans(_EN_DIGITS, _BN_DIGITS)
_BN_TO_EN = str.maketrans(_BN_DIGITS, _EN_DIGITS)

_MONTHS_BN = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
]


def to_bangla_digits(text: str) -> str:
    return text.translate(_EN_TO_BN)


def to_english_digits(text: str) -> str:
    return text.translate(_BN_TO_EN)


def _group_Indian(num: int) -> str:
    """Indian digit grouping: 30,00,000 (lakh style). Latin digits."""
    s = str(num)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups + [tail])


def format_taka(amount_paisa: int, locale: str = "bn") -> str:
    """paisa -> '৳30,000' (bn: '৳৩০,০০০'). Negative amounts get a minus sign."""
    sign = "-" if amount_paisa < 0 else ""
    taka = abs(amount_paisa) // 100
    grouped = _group_Indian(taka)
    if locale == "bn":
        grouped = to_bangla_digits(grouped)
    return f"{sign}৳{grouped}"


def format_probability(p: float, locale: str = "bn") -> str:
    """0.62 -> '62%' (bn: '৬২%'). Rounds half up to a whole percent."""
    pct = int(p * 100 + 0.5)
    s = f"{pct}%"
    return to_bangla_digits(s) if locale == "bn" else s


def format_number(n: int, locale: str = "bn") -> str:
    grouped = _group_Indian(abs(n))
    if locale == "bn":
        grouped = to_bangla_digits(grouped)
    return ("-" if n < 0 else "") + grouped


def format_date(d: dt.date, locale: str = "bn") -> str:
    """date -> '30 Sep 2026' (bn: '৩০ সেপ্টেম্বর ২০২৬')."""
    if locale == "bn":
        return f"{to_bangla_digits(str(d.day))} {_MONTHS_BN[d.month - 1]} {to_bangla_digits(str(d.year))}"
    return f"{d.day} {d.strftime('%b %Y')}"
