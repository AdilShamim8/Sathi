"""Loads config/*.yaml once into immutable dataclasses. This module is the
'configuration' boundary: it does I/O so that core/ can stay pure.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

CONFIG_DIR = Path(__file__).parent / "config"


def _load(name: str) -> dict[str, Any]:
    with open(CONFIG_DIR / f"{name}.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


@dataclass(frozen=True)
class SathiConfig:
    raw: dict[str, Any]
    config_hash: str

    def section(self, name: str) -> dict[str, Any]:
        return self.raw[name]


def load_config(config_dir: Path | None = None) -> SathiConfig:
    base = config_dir or CONFIG_DIR
    raw: dict[str, Any] = {}
    for path in sorted(base.glob("*.yaml")):
        with open(path, encoding="utf-8") as f:
            raw.update(yaml.safe_load(f))
    h = hashlib.sha256(repr(sorted(raw.items())).encode()).hexdigest()[:12]
    return SathiConfig(raw=raw, config_hash=h)
