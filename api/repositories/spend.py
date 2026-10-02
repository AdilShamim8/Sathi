"""LLM spend counter. One row per server day; reset on redeploy is a known
limitation (docs/risks.md) — the provider dashboard holds the hard cap."""
from __future__ import annotations

import sqlite3


def get_calls(conn: sqlite3.Connection, day: str) -> int:
    row = conn.execute("SELECT calls FROM llm_spend WHERE day = ?", (day,)).fetchone()
    return int(row["calls"]) if row else 0


def increment(conn: sqlite3.Connection, day: str) -> int:
    conn.execute(
        "INSERT INTO llm_spend(day, calls) VALUES(?, 1) "
        "ON CONFLICT(day) DO UPDATE SET calls = calls + 1",
        (day,),
    )
    conn.commit()
    return get_calls(conn, day)
