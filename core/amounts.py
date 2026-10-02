"""Deterministic amount parser (invariant 24: the LLM never parses money).

Handles Bengali digits, Bangla number words, 'হাজার/লাখ' units, 'k' suffixes
and comma grouping. Returns an ambiguity flag instead of guessing; the UI
confirms the parsed amount with the user before it is used anywhere.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from core.formatting import to_english_digits

# Bangla number words 1-100 (standard forms). Enough for "ত্রিশ হাজার" style.
_BN_WORDS: dict[str, int] = {
    "শূন্য": 0, "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5,
    "ছয়": 6, "ছয়টি": 6, "সাত": 7, "আট": 8, "নয়": 9, "দশ": 10,
    "এগারো": 11, "বারো": 12, "তেরো": 13, "চৌদ্দ": 14, "পনেরো": 15,
    "ষোলো": 16, "সতেরো": 17, "আঠারো": 18, "ঊনিশ": 19, "বিশ": 20, "কুড়ি": 20,
    "একুশ": 21, "বাইশ": 22, "তেইশ": 23, "চব্বিশ": 24, "পঁচিশ": 25,
    "ছাব্বিশ": 26, "সাতাশ": 27, "আটাশ": 28, "ঊনত্রিশ": 29, "ত্রিশ": 30,
    "একত্রিশ": 31, "বত্রিশ": 32, "তেত্রিশ": 33, "চৌত্রিশ": 34, "পঁয়ত্রিশ": 35,
    "ছত্রিশ": 36, "সাঁইত্রিশ": 37, "আটত্রিশ": 38, "ঊনচল্লিশ": 39, "চল্লিশ": 40,
    "একচল্লিশ": 41, "বিয়াল্লিশ": 42, "তেতাল্লিশ": 43, "চুয়াল্লিশ": 44,
    "পঁয়তাল্লিশ": 45, "ছেচল্লিশ": 46, "সাতচল্লিশ": 47, "আটচল্লিশ": 48,
    "ঊনপঞ্চাশ": 49, "পঞ্চাশ": 50, "একান্ন": 51, "বাহান্ন": 52, "তিপ্পান্ন": 53,
    "চুয়ান্ন": 54, "পঞ্চান্ন": 55, "ছাপ্পান্ন": 56, "সাতান্ন": 57,
    "আটান্ন": 58, "ঊনষাট": 59, "ষাট": 60, "একষট্টি": 61, "বাষট্টি": 62,
    "তেষট্টি": 63, "চৌষট্টি": 64, "পয়ষট্টি": 65, "ছেষট্টি": 66,
    "সাতষট্টি": 67, "আটষট্টি": 68, "ঊনসত্তর": 69, "সত্তর": 70,
    "একাত্তর": 71, "বাহাত্তর": 72, "তিয়াত্তর": 73, "চুয়াত্তর": 74,
    "পঁচাত্তর": 75, "ছিয়াত্তর": 76, "সাতাত্তর": 77, "আটাত্তর": 78,
    "ঊনআশি": 79, "আশি": 80, "একাশি": 81, "বিরাশি": 82, "তিরাশি": 83,
    "চুরাশি": 84, "পঁচাশি": 85, "ছিয়াশি": 86, "সাতাশি": 87, "অটাশি": 88,
    "ঊননব্বই": 89, "নব্বই": 90, "একানব্বই": 91, "বিরানব্বই": 92,
    "তিরানব্বই": 93, "চুরানব্বই": 94, "পঁচানব্বই": 95, "ছিয়ানব্বই": 96,
    "সাতানব্বই": 97, "আটানব্বই": 98, "নিরানব্বই": 99, "একশ": 100, "একশো": 100,
}

_UNIT_WORDS = {"হাজার": 1_000, "লাখ": 100_000, "লক্ষ": 100_000, "কোটি": 10_000_000}
_STRIP_WORDS = {"টাকা", "টাকার", "টাকায়", "taka", "tk", "৳", "bdt", "only", "কাছাকাছি", "প্রায়", "মতো", "জমাতে", "জমানো", "জমাব", "চাই", "লাগবে", "দরকার", "সেভ", "save", "savings", "need", "want"}


@dataclass(frozen=True)
class ParsedAmount:
    amount_paisa: int | None  # None when unparseable
    ambiguous: bool           # True when the magnitude unit is unclear
    note: str                 # machine-readable reason ("ok", "no_number", ...)


def _eval_phrase(phrase: list[str]) -> int | None:
    """Evaluate one number phrase: words/digits plus optional unit words.

    'ত্রিশ হাজার' -> 30_000; 'পঁচিশ হাজার পাঁচ শো' -> 25_500; '30k' -> 30_000.
    """
    total = 0
    current: float = 0
    seen = False
    for tok in phrase:
        m = re.fullmatch(r"(\d+(?:\.\d+)?)(k?)", tok)
        if m:
            current += float(m.group(1)) * (1000 if m.group(2) else 1)
            seen = True
        elif tok in _BN_WORDS:
            current += _BN_WORDS[tok]
            seen = True
        elif tok in ("শত", "শো") and current > 0:
            current *= 100
            seen = True
        elif tok in _UNIT_WORDS:
            total += max(current, 1) * _UNIT_WORDS[tok]
            current = 0
            seen = True
        else:
            return None
    return int(total + current) if seen else None


def parse_amount(text: str) -> ParsedAmount:
    """Parse a spoken/typed amount into paisa. Never guesses on ambiguity.

    Rules:
      - '৩০ হাজার', 'ত্রিশ হাজার', '30k', '30,000', '৩০,০০০' -> ৳30,000.
      - Digits with ৳/টাকা or >= 1000 are taken as taka directly.
      - Bare small numbers (< 1000, no unit) are ambiguous: 30 taka or 30,000?
      - With several number phrases ('6 মাসে 30 হাজার'), the phrase carrying a
        unit word (হাজার/লাখ/k) wins.
    """
    cleaned = to_english_digits(text.lower())
    cleaned = re.sub(r"(\d),(\d)", r"\1\2", cleaned)  # join '30,000' -> '30000'
    tokens = [t for t in re.split(r"[\s।,]+", cleaned) if t and t not in _STRIP_WORDS]
    if not tokens:
        return ParsedAmount(None, False, "no_number")

    # Scan for number phrases: a digit/word-number run, optionally closed by
    # unit words. Anything else is skipped ('আমি', 'মাসে', ...).
    phrases: list[tuple[int, bool]] = []  # (taka value, has_unit)
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        is_num = bool(re.fullmatch(r"\d+(?:\.\d+)?k?", tok)) or tok in _BN_WORDS
        if not is_num:
            i += 1
            continue
        phrase = [tok]
        j = i + 1
        while j < len(tokens) and (
            tokens[j] in _BN_WORDS or tokens[j] in ("শত", "শো") or tokens[j] in _UNIT_WORDS
        ):
            phrase.append(tokens[j])
            j += 1
        value = _eval_phrase(phrase)
        if value is not None:
            has_unit = any(t in _UNIT_WORDS for t in phrase) or phrase[0].endswith("k")
            phrases.append((value, has_unit))
        i = j

    if not phrases:
        return ParsedAmount(None, False, "no_number")

    with_unit = [p for p in phrases if p[1]]
    value, has_unit = with_unit[0] if with_unit else phrases[0]
    has_marker = has_unit or ("৳" in text) or ("টাকা" in text)
    ambiguous = value < 1000 and not has_marker
    return ParsedAmount(int(value * 100), ambiguous, "ok")
