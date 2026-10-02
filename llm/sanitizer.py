"""Prompt sanitizer and input safety filter (architecture §12 / invariant 2).

Protects LLM layers from prompt injection, system leakage, jailbreak attempts,
and instructions attempting money movement or unauthorized actions.
"""
from __future__ import annotations

import re
import unicodedata

_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions",
    r"system\s+prompt",
    r"you\s+are\s+now",
    r"dan\s+mode",
    r"reveal\s+(api\s+)?key",
    r"transfer\s+money",
    r"send\s+taka",
    r"approve\s+loan",
    r"disregard\s+rules",
    r"bypass\s+safety",
    r"টাকা\s*পাঠাও",
    r"টাকা\s*কাটো",
    r"লোন\s*অনুমোদন",
    r"নিয়ম\s*ভুলে\s*যাও",
]

_COMPILED_INJECTIONS = [re.compile(p, re.IGNORECASE) for p in _INJECTION_PATTERNS]


def sanitize_input(text: str) -> tuple[str, bool]:
    """Sanitize user input string.

    Returns:
        (cleaned_text, is_safe)
        where is_safe is False if any injection or prohibited intent pattern was flagged.
    """
    if not text:
        return "", True

    # 1. Normalize unicode (NFC)
    normalized = unicodedata.normalize("NFC", text)

    # 2. Strip non-printable control characters (except newline, tab)
    cleaned = "".join(ch for ch in normalized if ch == "\n" or ch == "\t" or not unicodedata.category(ch).startswith("C"))
    cleaned = cleaned.strip()

    # 3. Check for adversarial injection or prohibited intent patterns
    for pattern in _COMPILED_INJECTIONS:
        if pattern.search(cleaned):
            return cleaned, False

    return cleaned, True
