"""Reviewed template renderer. Templates live in llm/templates/<locale>/*.txt
as Python format strings; all values arrive pre-formatted by
core/formatting.py, so a template never computes anything.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

TEMPLATES = Path(__file__).parent / "templates"
SUPPORTED = ("bn", "en")


@lru_cache(maxsize=None)
def _load(locale: str, name: str) -> str:
    path = TEMPLATES / locale / f"{name}.txt"
    return path.read_text(encoding="utf-8").strip()


def render(name: str, locale: str = "bn", **values: str) -> str:
    """Render a named template. Unknown locales fall back to Bangla."""
    if locale not in SUPPORTED:
        locale = "bn"
    return _load(locale, name).format(**values)
