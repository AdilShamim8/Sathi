"""Maps repository rows to core dataclasses and back. The only place row
dicts become domain objects."""
from __future__ import annotations

import datetime as dt

import pandas as pd

from core.schemas import Txn, TxnType


def row_to_txn(row: dict) -> Txn:
    ts = dt.datetime.fromisoformat(row["ts"].replace("Z", "+00:00"))
    return Txn(
        txn_id=row["txn_id"],
        ts=ts,
        type=TxnType(row["type"]),
        amount_paisa=int(row["amount_paisa"]),
        fee_paisa=int(row["fee_paisa"]),
        counterparty_id=row["counterparty_id"],
        counterparty_type=row["counterparty_type"],
        counterparty_category=row["counterparty_category"],
        counterparty_accepts_digital=bool(row["counterparty_accepts_digital"]),
        channel=row["channel"],
        balance_after_paisa=int(row["balance_after_paisa"]),
    )


def rows_to_frame(rows: list[dict]) -> pd.DataFrame:
    """DataFrame with the columns ml.features expects (plus is_inflow)."""
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["txn_id", "user_id", "ts", "type", "amount_paisa",
                                     "fee_paisa", "counterparty_id", "counterparty_type",
                                     "counterparty_category", "counterparty_accepts_digital",
                                     "channel", "balance_after_paisa", "is_inflow"])
    df["ts"] = pd.to_datetime(df["ts"], utc=True)
    df["is_inflow"] = df["type"].isin(["salary_in", "remittance_in", "cash_in"])
    return df
