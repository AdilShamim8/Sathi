"""Numeric validator: fail-closed safety check on generated text (invariant 2).

Every figure in LLM-generated text must match a figure from verified tool
output. If a hallucinated or ungrounded number is detected — written as
digits (Bangla ০-৯ or English 0-9) OR as number words ("five thousand",
"পাঁচ হাজার") — the validator fails and the system falls closed to a
reviewed deterministic Bangla template.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from core.formatting import to_english_digits

_NUM_PATTERN = re.compile(r"(\d+(?:[,\.]\d+)?)")

# --- Number words (English + Bangla). A verbal figure is as hallucinable as a
# digit figure, so both are extracted and validated against the same allowlist.
_EN_UNIT_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
    "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70,
    "eighty": 80, "ninety": 90,
}
_EN_SCALE_WORDS = {
    "hundred": 100, "thousand": 1_000, "k": 1_000, "lakh": 100_000,
    "crore": 10_000_000, "million": 1_000_000,
}
_BN_UNIT_WORDS = {
    "শূন্য": 0, "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5, "ছয়": 6,
    "সাত": 7, "আট": 8, "নয়": 9, "দশ": 10, "এগারো": 11, "বারো": 12,
    "তেরো": 13, "চৌদ্দ": 14, "পনেরো": 15, "ষোলো": 16, "সতেরো": 17,
    "আঠারো": 18, "উনিশ": 19, "বিশ": 20, "ত্রিশ": 30, "চল্লিশ": 40,
    "পঞ্চাশ": 50, "ষাট": 60, "সত্তর": 70, "আশি": 80, "নব্বই": 90,
}
_BN_SCALE_WORDS = {
    "শত": 100, "হাজার": 1_000, "লাখ": 100_000, "কোটি": 10_000_000,
}
_WORD_TOKEN_RE = re.compile(r"[A-Za-z\u0980-\u09FF]+")


def _parse_word_number(tokens: list[str]) -> float | None:
    """Combine a run of number words into one value.

    English: "twenty five thousand" -> 25000. Bangla: "পাঁচ হাজার" -> 5000,
    "দুই শত" -> 200. Returns None when the run is not a number phrase.
    """
    units = {**_EN_UNIT_WORDS, **_BN_UNIT_WORDS}
    scales = {**_EN_SCALE_WORDS, **_BN_SCALE_WORDS}
    total = 0.0
    current = 0.0
    saw_any = False
    for tok in tokens:
        low = tok.lower()
        if low in units:
            current += units[low]
            saw_any = True
        elif tok in scales or low in scales:
            scale = scales.get(tok, scales.get(low))
            total += (current if current else 1) * scale
            current = 0.0
            saw_any = True
        else:
            return None
    return (total + current) if saw_any else None


def extract_number_words(text: str) -> set[float]:
    """Extract numbers written as EN/BN words ("five thousand", "পাঁচ হাজার")."""
    out: set[float] = set()
    tokens = _WORD_TOKEN_RE.findall(text)
    i = 0
    while i < len(tokens):
        low = tokens[i].lower()
        if low in _EN_UNIT_WORDS or low in _EN_SCALE_WORDS or tokens[i] in _BN_UNIT_WORDS or tokens[i] in _BN_SCALE_WORDS:
            # Greedily consume the contiguous number-word run.
            j = i
            while j < len(tokens):
                lj = tokens[j].lower()
                if (lj in _EN_UNIT_WORDS or lj in _EN_SCALE_WORDS
                        or tokens[j] in _BN_UNIT_WORDS or tokens[j] in _BN_SCALE_WORDS):
                    j += 1
                else:
                    break
            val = _parse_word_number(tokens[i:j])
            if val is not None:
                out.add(round(val, 2))
            i = j
        else:
            i += 1
    return out


def extract_numbers(text: str) -> set[float]:
    """Extract all numbers from text: digits (Bangla/English) AND number words."""
    text_en = to_english_digits(text)
    # Remove comma separators in digits (e.g. 25,000 -> 25000)
    cleaned = re.sub(r"(?<=\d),(?=\d)", "", text_en)
    numbers = set()
    for match in _NUM_PATTERN.finditer(cleaned):
        val_str = match.group(1)
        try:
            val = float(val_str)
            numbers.add(round(val, 2))
            if val.is_integer():
                numbers.add(int(val))
        except ValueError:
            continue
    numbers |= extract_number_words(text)
    return numbers


@dataclass(frozen=True)
class ValidationResult:
    passed: bool
    hallucinated_numbers: list[float]
    extracted_numbers: list[float]


def validate_numbers(generated_text: str, allowed_numbers: set[float | int]) -> ValidationResult:
    """Validate that every number in generated_text is in allowed_numbers.

    If any number is not grounded in the allowed set, returns passed=False.
    """
    extracted = extract_numbers(generated_text)
    normalized_allowed = set()
    for n in allowed_numbers:
        normalized_allowed.add(round(float(n), 2))
        if isinstance(n, int) or float(n).is_integer():
            normalized_allowed.add(int(n))

    hallucinated = []
    for num in extracted:
        # Check if number matches any allowed number directly or within small tolerance
        matched = False
        for allowed in normalized_allowed:
            if abs(num - allowed) < 0.01:
                matched = True
                break
        if not matched:
            hallucinated.append(num)

    return ValidationResult(
        passed=len(hallucinated) == 0,
        hallucinated_numbers=sorted(hallucinated),
        extracted_numbers=sorted(list(extracted)),
    )
