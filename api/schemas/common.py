"""Shared API contract pieces: the evidence block and the envelope shapes.

Success: {"data": ..., "evidence": {...}}. Error: {"error": {...}}.
Money is integer paisa with a paired display string. Probabilities are 0-1
floats with a paired display string. The UI renders display strings verbatim
(invariant 19).
"""
from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict

InsightLabel = Literal["Data", "Prediction", "Assumption", "Generated text"]

T = TypeVar("T")


class AssumptionNote(BaseModel):
    id: str
    value: str
    label: Literal["Assumption"] = "Assumption"


class DataUsed(BaseModel):
    window: str
    as_of_date: str
    n_transactions: int
    source: Literal["synthetic"] = "synthetic"


class ModelVersions(BaseModel):
    forecast: str
    categorizer: str = "rules-v1"


class ValidatorInfo(BaseModel):
    passed: bool
    fallback_used: bool


class Evidence(BaseModel):
    data_used: DataUsed
    model_version: ModelVersions
    config_hash: str
    assumptions: list[AssumptionNote]
    labels: dict[str, InsightLabel]
    generated_text: bool = False
    prompt_version: str | None = None
    validator: ValidatorInfo


class Envelope(BaseModel, Generic[T]):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    data: T
    evidence: Evidence


class ErrorBody(BaseModel):
    code: str
    message_bn: str
    message_en: str
    request_id: str


class ErrorEnvelope(BaseModel):
    error: ErrorBody
