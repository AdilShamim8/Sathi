"""Shared counterparty pool for the synthetic world. Synthetic ids only."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Counterparty:
    counterparty_id: str
    type: str            # agent | merchant | biller | operator | person
    category: str        # rent | food | transport | utilities | mobile | business | family | employer | agent | other
    accepts_digital: bool


def build_counterparties() -> list[Counterparty]:
    """A fixed pool; ids are synthetic and carry no real-world meaning."""
    pool: list[Counterparty] = []
    for i in range(40):
        pool.append(Counterparty(f"agent_{i:03d}", "agent", "agent", False))
    # Merchants: a mix of digital-accepting and cash-only, per category.
    for i in range(20):
        pool.append(Counterparty(f"merch_food_d{i:02d}", "merchant", "food", True))
    for i in range(8):
        pool.append(Counterparty(f"merch_food_c{i:02d}", "merchant", "food", False))
    for i in range(12):
        pool.append(Counterparty(f"merch_tr_d{i:02d}", "merchant", "transport", True))
    for i in range(6):
        pool.append(Counterparty(f"merch_tr_c{i:02d}", "merchant", "transport", False))
    for i in range(10):
        pool.append(Counterparty(f"merch_ot_d{i:02d}", "merchant", "other", True))
    for i in range(6):
        pool.append(Counterparty(f"merch_ot_c{i:02d}", "merchant", "other", False))
    for i in range(8):
        pool.append(Counterparty(f"merch_biz_{i:02d}", "merchant", "business", True))
    pool.append(Counterparty("biller_util", "biller", "utilities", True))
    pool.append(Counterparty("operator_mob", "operator", "mobile", True))
    for i in range(10):
        pool.append(Counterparty(f"person_{i:02d}", "person", "family", False))
    pool.append(Counterparty("person_landlord", "person", "rent", False))
    pool.append(Counterparty("person_employer", "person", "employer", True))
    pool.append(Counterparty("person_supplier", "person", "business", True))
    pool.append(Counterparty("remit_house", "person", "remittance", True))
    return pool
