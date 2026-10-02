"""Structured JSON request logs. No message bodies, tokens or secrets."""
from __future__ import annotations

import json
import logging
import sys
import time


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        out = {
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
        }
        for key in ("request_id", "route", "latency_ms", "status", "model_version", "config_hash"):
            val = getattr(record, key, None)
            if val is not None:
                out[key] = val
        return json.dumps(out, ensure_ascii=False)


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


class Timer:
    def __init__(self) -> None:
        self._t0 = time.perf_counter()

    @property
    def ms(self) -> int:
        return int((time.perf_counter() - self._t0) * 1000)
