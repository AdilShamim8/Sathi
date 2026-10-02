"""Numeric validator: fail-closed safety check on generated text (invariant 2).

Every figure in LLM-generated text must match a figure from verified tool
output. If a hallucinated or ungrounded number is detected, the validator
fails and the system falls closed to a reviewed deterministic Bangla template.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from core.formatting import to_english_digits

_NUM_PATTERN = re.compile(r"(\d+(?:[,\.]\d+)?)")


def extract_numbers(text: str) -> set[float]:
    """Extract all numbers from text, normalizing Bengali digits and commas."""
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
