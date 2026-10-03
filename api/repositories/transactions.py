"""Transaction reads. Parameterized queries only (code-standards §7)."""
from __future__ import annotations

import sqlite3

_COLUMNS = ("txn_id, user_id, ts, type, amount_paisa, fee_paisa, counterparty_id, "
            "counterparty_type, counterparty_category, counterparty_accepts_digital, "
            "channel, balance_after_paisa")


def list_for_user(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    """Full history, oldest first. Synthetic users have hundreds of rows."""
    rows = conn.execute(
        f"SELECT {_COLUMNS} FROM transactions WHERE user_id = ? ORDER BY ts, txn_id",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def list_page(conn: sqlite3.Connection, user_id: str, page: int, page_size: int) -> tuple[list[dict], int]:
    """Newest first for the transactions screen."""
    total = conn.execute(
        "SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?", (user_id,)
    ).fetchone()["c"]
    rows = conn.execute(
        f"SELECT {_COLUMNS} FROM transactions WHERE user_id = ? "
        "ORDER BY ts DESC, txn_id DESC LIMIT ? OFFSET ?",
        (user_id, page_size, (page - 1) * page_size),
    ).fetchall()
    return [dict(r) for r in rows], int(total)


def count_for_user(conn: sqlite3.Connection, user_id: str) -> int:
    return int(conn.execute(
        "SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?", (user_id,)
    ).fetchone()["c"])
