"""Schemas for forecast, cashout, goals, auth, chat, and amount endpoints."""
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


# --- Auth & Demo Users ---
class DemoLoginRequest(BaseModel):
    user_id: str


class DemoLoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user_id: str
    persona: str


class DemoUserItem(BaseModel):
    user_id: str
    persona: str
    persona_label_bn: str
    persona_label_en: str
    age_band: str
    region: str
    income_band: str


# --- Forecast ---
class DailyForecastPoint(BaseModel):
    date: str
    p10_paisa: int
    p10_display: str
    p50_paisa: int
    p50_display: str
    p90_paisa: int
    p90_display: str


class ForecastData(BaseModel):
    horizon_days: int
    as_of_date: str
    start_balance_paisa: int
    start_balance_display: str
    shortfall_prob: float
    shortfall_prob_display: str
    risk_level: Literal["low", "medium", "high"]
    trough_date: str | None
    confidence: Literal["normal", "low"]
    days: list[DailyForecastPoint]


# --- Cashout ---
class CashoutPatternOut(BaseModel):
    counterparty_id: str
    count: int
    total_amount_paisa: int
    total_amount_display: str
    total_fee_paisa: int
    total_fee_display: str
    replaceable_count: int
    replaceable_amount_paisa: int
    replaceable_amount_display: str
    replaceable_fee_saved_paisa: int
    replaceable_fee_saved_display: str


class CashoutData(BaseModel):
    patterns: list[CashoutPatternOut]
    total_cashouts: int
    total_fees_paisa: int
    total_fees_display: str
    replaceable_count: int
    replaceable_amount_paisa: int
    replaceable_amount_display: str
    replaceable_fee_saved_paisa: int
    replaceable_fee_saved_display: str
    cash_dependency_ratio: float | None
    cash_dependency_ratio_display: str | None


# --- Goal Planner ---
class GoalPlanOptionOut(BaseModel):
    key: str
    title_bn: str
    title_en: str
    monthly_contribution_paisa: int
    monthly_contribution_display: str
    percent_of_inflow: float | None
    months: int
    p_goal_met: float
    p_goal_met_display: str
    p_low: float
    p_high: float
    tradeoff_bn: str
    tradeoff_en: str


class GoalPlanRequest(BaseModel):
    goal_type: str = "emergency_fund"
    target_paisa: int = Field(gt=0)
    months: int = Field(gt=0, le=60)


class GoalPlanData(BaseModel):
    target_paisa: int
    target_display: str
    requested_months: int
    monthly_required_paisa: int
    monthly_required_display: str
    p_requested: float
    p_requested_display: str
    verdict: str
    options: list[GoalPlanOptionOut]
    feasibility_note_bn: str
    feasibility_note_en: str


# --- Chat & Amount Parser ---
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    locale: Literal["bn", "en"] = "bn"


class ChatData(BaseModel):
    reply: str
    intent: str
    fallback_used: bool
    generated_text: bool
    refusal: bool


class ParseAmountRequest(BaseModel):
    text: str = Field(min_length=1, max_length=200)


class ParseAmountData(BaseModel):
    raw_text: str
    amount_paisa: int | None
    amount_display: str | None
    ambiguous: bool
    note: str
