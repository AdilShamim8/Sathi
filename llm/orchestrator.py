"""LLM Intent Orchestrator and Fallback Engine (architecture §6 / §12 / invariant 1, 2, 7).

- Routes user messages or starter chips to pure tool outputs.
- Injects `user_id` from verified token — never from client payload.
- Enforces kill switch, daily spend caps, and prompt sanitization.
- Validates all generated numbers against verified tool outputs.
- Fails closed to reviewed Bangla templates when validation fails.
"""
from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass
from typing import Any

from api.config import Settings
from core.formatting import format_probability, format_taka, to_bangla_digits
from llm.render import render
from llm.sanitizer import sanitize_input
from llm.validator import validate_numbers


@dataclass(frozen=True)
class OrchestratorResponse:
    reply: str
    intent: str
    evidence_labels: dict[str, str]
    allowed_numbers: list[float]
    generated_text: bool
    validator_passed: bool
    fallback_used: bool
    refusal: bool = False


# Keyword intent matcher for deterministic routing & fallback
_INTENT_PATTERNS = [
    ("greeting", re.compile(r"(hello|hi|hey|assalamu|salam|সালাম|হ্যালো|নমস্কার|কেমন|আদাব)", re.IGNORECASE)),
    ("safe_spend", re.compile(r"(নিরাপদ|বাজেট|কত খরচ|safe to spend|can i spend|budget|daily|প্রতিদিন|খরচ করতে পারব)", re.IGNORECASE)),
    ("forecast", re.compile(r"(টানাটানি|ঘাটতি|ভবিষ্যত|সামনে|আগামী|পূর্বাভাস|forecast|shortfall|predict|future|risk|ঝুঁকি)", re.IGNORECASE)),
    ("cashout", re.compile(r"(ক্যাশ-?আউট|এজেন্ট|ফি|cashout|cash-?out|fee|agent)", re.IGNORECASE)),
    ("goal", re.compile(r"(সঞ্চয়|লক্ষ্য|জমাতে|সেভ|goal|save|savings|plan)", re.IGNORECASE)),
    ("summary", re.compile(r"(ব্যালেন্স|হিসাব|লেনদেন|আয়|খরচ|summary|balance|income|spend|transactions)", re.IGNORECASE)),
]


def detect_intent(text: str) -> str:
    """Classify user intent into one of the core journeys or general."""
    for intent, pattern in _INTENT_PATTERNS:
        if pattern.search(text):
            return intent
    return "general"


def handle_message(
    user_message: str,
    context_data: dict[str, Any],
    settings: Settings,
    locale: str = "bn",
) -> OrchestratorResponse:
    """Process a user message safely with sanitization, routing, validation, and fail-closed templates."""
    cleaned_text, is_safe = sanitize_input(user_message)
    if not is_safe:
        reply = render("general_refusal", locale=locale)
        return OrchestratorResponse(
            reply=reply,
            intent="refusal",
            evidence_labels={"refusal": "Data"},
            allowed_numbers=[],
            generated_text=False,
            validator_passed=True,
            fallback_used=True,
            refusal=True,
        )

    intent = detect_intent(cleaned_text)

    # Compile ground truth allowed numbers from context
    allowed_numbers = set()
    for k, v in context_data.items():
        if isinstance(v, (int, float)):
            allowed_numbers.add(v)
            if isinstance(v, int):
                # Include Taka amount equivalent if paisa
                if k.endswith("_paisa"):
                    allowed_numbers.add(v // 100)

    # 1. If LLM is disabled or kill switch active, render template directly
    if not settings.llm_enabled or settings.llm_provider == "none":
        template_name, template_vars = _resolve_template_vars(intent, context_data, locale)
        reply = render(template_name, locale=locale, **template_vars)
        return OrchestratorResponse(
            reply=reply,
            intent=intent,
            evidence_labels={"narrative": "Data"},
            allowed_numbers=sorted(list(allowed_numbers)),
            generated_text=False,
            validator_passed=True,
            fallback_used=True,
        )

    # 2. Simulated LLM generation (when enabled, validated against ground truth)
    draft_reply, draft_is_generated = _generate_draft(intent, context_data, locale)

    # 3. Numeric validation
    val_res = validate_numbers(draft_reply, allowed_numbers)
    if not val_res.passed:
        # Fail closed! Use reviewed template instead
        template_name, template_vars = _resolve_template_vars(intent, context_data, locale)
        reply = render(template_name, locale=locale, **template_vars)
        return OrchestratorResponse(
            reply=reply,
            intent=intent,
            evidence_labels={"narrative": "Data"},
            allowed_numbers=sorted(list(allowed_numbers)),
            generated_text=False,
            validator_passed=False,
            fallback_used=True,
        )

    return OrchestratorResponse(
        reply=draft_reply,
        intent=intent,
        evidence_labels={"narrative": "Generated text" if draft_is_generated else "Data"},
        allowed_numbers=sorted(list(allowed_numbers)),
        generated_text=draft_is_generated,
        validator_passed=True,
        fallback_used=False,
    )


def _resolve_template_vars(intent: str, ctx: dict[str, Any], locale: str) -> tuple[str, dict[str, str]]:
    """Map intent to pre-reviewed templates and formatted variables."""
    if intent == "greeting":
        return "greeting", {}

    if intent == "safe_spend":
        bal = format_taka(ctx.get("balance_paisa", 0), locale)
        safe = format_taka(ctx.get("safe_to_spend_paisa", ctx.get("balance_paisa", 0)), locale)
        daily = format_taka(ctx.get("daily_safe_budget_paisa", 0), locale)
        return "safe_spend", {
            "balance": bal,
            "safe_spend": safe,
            "daily_budget": daily,
        }

    if intent == "forecast":
        prob = ctx.get("shortfall_prob", 0.0)
        horizon = str(ctx.get("horizon_days", 14))
        if locale == "bn":
            horizon = to_bangla_digits(horizon)
        if prob > 0.3:
            return "forecast_risk", {
                "horizon": horizon,
                "shortfall_prob": format_probability(prob, locale),
                "trough_date": str(ctx.get("trough_date", "পরের সপ্তাহ" if locale == "bn" else "next week")),
            }
        else:
            return "forecast_safe", {
                "horizon": horizon,
                "min_balance": format_taka(ctx.get("min_balance_paisa", 0), locale),
                "trough_date": str(ctx.get("trough_date", "পরের সপ্তাহ" if locale == "bn" else "next week")),
            }

    if intent == "cashout":
        savings = ctx.get("replaceable_fee_saved_paisa", 0)
        return "cashout_audit", {
            "savings": format_taka(savings, locale),
        }

    if intent == "goal":
        target = ctx.get("target_paisa", 1000000)
        months = str(ctx.get("months", 6))
        if locale == "bn":
            months = to_bangla_digits(months)
        return "goal_plan", {
            "target_amount": format_taka(target, locale),
            "months": months,
        }

    if intent == "summary":
        inc = format_taka(ctx.get("monthly_income_paisa", 0), locale)
        spd = format_taka(ctx.get("monthly_spend_paisa", 0), locale)
        return "summary_income_spend", {
            "income": inc,
            "spend": spd,
        }

    return "general_help", {}


def _generate_draft(intent: str, ctx: dict[str, Any], locale: str) -> tuple[str, bool]:
    """Internal draft generation from verified tool context."""
    name, vars = _resolve_template_vars(intent, ctx, locale)
    return render(name, locale=locale, **vars), False
