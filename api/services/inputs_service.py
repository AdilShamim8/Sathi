"""User inputs service — user-declared liquidity corrections (mission P0).

Liquidity = wallet balance + estimated cash-on-hand + other explicitly
supported liquid funds. The behavioral estimator guesses cash-on-hand from
cash-out rhythm; a user declaration overrides it and then DECAYS forward at
the user's observed daily cash burn, so a stale declaration fades back
toward the behavioral estimate instead of overstating liquidity forever.

A cash-out is never treated as money vanishing: it leaves the wallet and
(re-)enters the pocket estimate subject to the burn decay.
"""
from __future__ import annotations

import datetime as dt
import sqlite3

from api.schemas.extended import UserInputsData, UserInputsRequest
from core.cash_on_hand import estimate_cash_on_hand

_INPUTS_COLS = (
    "cash_on_hand_paisa", "cash_on_hand_as_of", "income_day",
    "rent_amount_paisa", "rent_confirmed", "other_liquid_paisa", "updated_at",
)

# How many days a user cash declaration stays authoritative before the decay
# fully hands back to the behavioral estimate.
_DECLARATION_TTL_DAYS = 14


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _row_to_data(row: sqlite3.Row | None) -> UserInputsData:
    if row is None:
        return UserInputsData(
            cash_on_hand_paisa=None, cash_on_hand_as_of=None, income_day=None,
            rent_amount_paisa=None, rent_confirmed=False, other_liquid_paisa=None,
            updated_at=None,
        )
    return UserInputsData(
        cash_on_hand_paisa=row["cash_on_hand_paisa"],
        cash_on_hand_as_of=row["cash_on_hand_as_of"],
        income_day=row["income_day"],
        rent_amount_paisa=row["rent_amount_paisa"],
        rent_confirmed=bool(row["rent_confirmed"]),
        other_liquid_paisa=row["other_liquid_paisa"],
        updated_at=row["updated_at"],
    )


def get_inputs(conn: sqlite3.Connection, user_id: str) -> UserInputsData:
    row = conn.execute("SELECT * FROM user_inputs WHERE user_id = ?", (user_id,)).fetchone()
    return _row_to_data(row)


def update_inputs(conn: sqlite3.Connection, user_id: str, req: UserInputsRequest) -> UserInputsData:
    """Validate + persist a partial update. Only provided fields change."""
    current = get_inputs(conn, user_id)
    now = _now_iso()

    cash = current.cash_on_hand_paisa
    cash_as_of = current.cash_on_hand_as_of
    if req.cash_on_hand_taka is not None:
        cash = req.cash_on_hand_taka * 100
        cash_as_of = now

    conn.execute(
        """
        INSERT INTO user_inputs (user_id, cash_on_hand_paisa, cash_on_hand_as_of, income_day,
                                 rent_amount_paisa, rent_confirmed, other_liquid_paisa, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            cash_on_hand_paisa = excluded.cash_on_hand_paisa,
            cash_on_hand_as_of = excluded.cash_on_hand_as_of,
            income_day = excluded.income_day,
            rent_amount_paisa = excluded.rent_amount_paisa,
            rent_confirmed = excluded.rent_confirmed,
            other_liquid_paisa = excluded.other_liquid_paisa,
            updated_at = excluded.updated_at
        """,
        (
            user_id,
            cash,
            cash_as_of,
            req.income_day if req.income_day is not None else current.income_day,
            (req.rent_amount_taka * 100) if req.rent_amount_taka is not None else current.rent_amount_paisa,
            int(req.rent_confirmed) if req.rent_confirmed is not None else int(current.rent_confirmed),
            (req.other_liquid_taka * 100) if req.other_liquid_taka is not None else current.other_liquid_paisa,
            now,
        ),
    )
    conn.commit()
    return get_inputs(conn, user_id)


def effective_cash_on_hand(
    txns: list,
    as_of: dt.date,
    declared_paisa: int | None,
    declared_as_of: str | None,
) -> tuple[int, str]:
    """Blend a user declaration with the behavioral estimator.

    A fresh declaration wins; it then decays at the observed daily cash burn
    (max(0, declared - burn * age_days)). Once older than the TTL it is
    ignored entirely. Returns (paisa, source) where source describes the
    provenance surfaced to the user.
    """
    behavioral = estimate_cash_on_hand(txns, as_of)
    if declared_paisa is None or not declared_as_of:
        return behavioral.estimated_cash_paisa, "estimated (cash-out rhythm)"

    try:
        declared_date = dt.date.fromisoformat(declared_as_of[:10])
    except ValueError:
        return behavioral.estimated_cash_paisa, "estimated (cash-out rhythm)"

    age_days = (as_of - declared_date).days
    if age_days < 0:
        age_days = 0
    if age_days > _DECLARATION_TTL_DAYS:
        return behavioral.estimated_cash_paisa, "estimated (declaration expired)"

    burn = behavioral.daily_cash_burn_paisa or 0
    decayed = max(0, int(declared_paisa - burn * age_days))
    return decayed, f"user-declared, decayed {age_days}d at observed burn"
