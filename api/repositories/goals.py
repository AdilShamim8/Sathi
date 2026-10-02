"""Saved goals. Saving a goal stores a record only — it never moves money."""
from __future__ import annotations

import sqlite3


def insert_goal(conn: sqlite3.Connection, user_id: str, goal_type: str,
                target_amount_paisa: int, months: int, plan_option_key: str,
                monthly_contribution_paisa: int, created_at: str) -> int:
    cur = conn.execute(
        "INSERT INTO user_goals(user_id, goal_type, target_amount_paisa, months, "
        "plan_option_key, monthly_contribution_paisa, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, goal_type, target_amount_paisa, months, plan_option_key,
         monthly_contribution_paisa, created_at),
    )
    conn.commit()
    return int(cur.lastrowid)


def list_goals(conn: sqlite3.Connection, user_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT goal_id, goal_type, target_amount_paisa, months, plan_option_key, "
        "monthly_contribution_paisa, created_at FROM user_goals "
        "WHERE user_id = ? ORDER BY goal_id DESC",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]
