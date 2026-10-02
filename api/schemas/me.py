"""Schemas for /v1/me/summary, /v1/me/transactions and /v1/me/goals."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from api.schemas.common import InsightLabel


class UserRef(BaseModel):
    persona: str
    persona_label_bn: str
    persona_label_en: str


class MetricsOut(BaseModel):
    monthly_income_paisa: int
    monthly_income_display: str
    monthly_spend_paisa: int
    monthly_spend_display: str
    savings_rate: float | None
    savings_rate_display: str | None
    income_volatility: float | None
    income_volatility_display: str | None
    buffer_days: float | None
    buffer_days_display: str | None
    cash_dependency_ratio: float | None
    cash_dependency_ratio_display: str | None
    fee_leakage_paisa: int
    fee_leakage_display: str
    fixed_commitment_ratio: float | None
    fixed_commitment_ratio_display: str | None


class CategoryRow(BaseModel):
    category: str
    label_bn: str
    label_en: str
    total_paisa: int
    total_display: str
    share: float
    share_display: str


class Insight(BaseModel):
    id: str
    label: InsightLabel
    text_bn: str
    text_en: str


class SummaryData(BaseModel):
    user: UserRef
    as_of_date: str
    balance_paisa: int
    balance_display: str
    confidence: Literal["normal", "low"]
    metrics: MetricsOut
    categories: list[CategoryRow]
    insights: list[Insight]


class CounterpartyOut(BaseModel):
    id: str
    type: str
    category: str
    accepts_digital: bool


class CategoryTrace(BaseModel):
    category: str
    label_bn: str
    label_en: str
    rule_id: str
    reason_bn: str
    reason_en: str


class TransactionItem(BaseModel):
    txn_id: str
    ts: str
    type: str
    direction: Literal["in", "out"]
    amount_paisa: int
    amount_display: str
    fee_paisa: int
    fee_display: str
    counterparty: CounterpartyOut
    category: CategoryTrace
    balance_after_paisa: int
    balance_after_display: str


class TransactionsData(BaseModel):
    items: list[TransactionItem]
    page: int
    page_size: int
    total: int
    as_of_date: str


class GoalCreateRequest(BaseModel):
    goal_type: str
    target_paisa: int = Field(gt=0)
    months: int = Field(gt=0)
    plan_option_key: str
    monthly_contribution_paisa: int = Field(ge=0)


class GoalRecord(BaseModel):
    goal_id: int
    goal_type: str
    target_paisa: int
    target_display: str
    months: int
    plan_option_key: str
    monthly_contribution_paisa: int
    monthly_contribution_display: str
    created_at: str
    note_bn: str
    note_en: str


class GoalsData(BaseModel):
    goals: list[GoalRecord]
