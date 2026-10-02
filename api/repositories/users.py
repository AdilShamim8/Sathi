"""User lookups. Returns plain row dicts; services map them to domain types."""
from __future__ import annotations

import sqlite3


def get_user(conn: sqlite3.Connection, user_id: str) -> dict | None:
    row = conn.execute(
        "SELECT user_id, persona, age_band, region, income_band, created_at "
        "FROM users WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return dict(row) if row else None


def demo_users(conn: sqlite3.Connection) -> list[dict]:
    """One canonical demo user per persona (deterministic: smallest id)."""
    rows = conn.execute(
        "SELECT user_id, persona FROM users "
        "WHERE user_id IN (SELECT MIN(user_id) FROM users GROUP BY persona) "
        "ORDER BY persona"
    ).fetchall()
    return [dict(r) for r in rows]
