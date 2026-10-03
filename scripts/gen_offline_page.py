#!/usr/bin/env python3
"""Generate the Android offline fallback page (res/raw/offline.html).

Reads the committed demo persona bundles (web/public/demo/*.json — the API
envelope shape {user, summary, transactions, forecast, cashout, goal_plan,
engine}), flattens each into the display shape the offline template expects,
and injects everything into scripts/offline_template.html: a fully
self-contained page (data, styles, scripts) the WebView renders with zero
network access. The `engine` section (raw transactions) powers the on-device
deterministic engine (recurring detection, bootstrap simulation,
safe-to-spend, shortfall explanation, goal Monte Carlo).

MainActivity replaces __REASON__ / __ATTEMPT__ at runtime; this generator
must leave those placeholders untouched.

Re-run whenever the demo bundles change:

    python3 scripts/gen_offline_page.py
"""
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORDER = ["student", "garment_worker", "gig_driver", "remittance_household", "shopkeeper"]
TEMPLATE = ROOT / "scripts" / "offline_template.html"
DEST = ROOT / "web" / "android" / "app" / "src" / "main" / "res" / "raw" / "offline.html"

INFLOW_TYPES = {"cash_in", "salary_in", "remittance_in"}


def _iso_week(day: dt.date) -> tuple[int, int]:
    iso = day.isocalendar()
    return iso[0], iso[1]


def _weekly_outflows(txns: list[dict]) -> list[dict]:
    """Weekly outflow totals (taka) with ISO-week labels, largest flagged."""
    weeks: dict[tuple[int, int], float] = {}
    for t in txns:
        if t["type"] in INFLOW_TYPES:
            continue
        day = dt.date.fromisoformat(str(t["ts"])[:10])
        weeks.setdefault(_iso_week(day), 0.0)
        weeks[_iso_week(day)] += (t["amount_paisa"] + t.get("fee_paisa", 0)) / 100
    items = [
        {"isoWeek": wk, "outflow": round(total, 2)}
        for wk, total in sorted(weeks.items())
    ][-8:]
    if items:
        largest = max(items, key=lambda w: w["outflow"])
        for w in items:
            w["isLargest"] = w is largest
    return items


def flatten(bundle: dict) -> dict:
    """API envelope bundle -> the flat display shape the template consumes."""
    s = bundle["summary"]["data"]
    f = bundle["forecast"]["data"]
    co = bundle["cashout"]["data"]
    gp = bundle["goal_plan"]["data"]
    u = bundle["user"]
    eng = bundle.get("engine", {})
    txns = eng.get("transactions", [])

    def tk(paisa) -> float:
        return (paisa or 0) / 100

    rec = s.get("recurring", {})
    metrics = s.get("metrics", {})
    s2s = s.get("safe_to_spend", {})
    monthly_spend = tk(metrics.get("monthly_spend_paisa"))

    return {
        "generated_at": s.get("as_of_date"),
        "persona": u["persona"],
        "persona_label_bn": u.get("persona_label_bn", u["persona"]),
        "persona_label_en": u.get("persona_label_en", u["persona"]),
        "n_transactions": bundle["transactions"]["data"].get("total", len(txns)),
        "confidence": s.get("confidence"),
        "balance": tk(s.get("balance_paisa")),
        "balance_display": s.get("balance_display"),
        "safe_to_spend": {
            "total": tk(s2s.get("safe_to_spend_total_paisa")),
            "total_display": s2s.get("safe_to_spend_total_display"),
            "daily_budget": tk(s2s.get("daily_safe_budget_paisa")),
            "daily_budget_display": s2s.get("daily_safe_budget_display"),
            "status": s2s.get("status"),
            "status_label_en": s2s.get("status_label_en"),
            "advice_en": s2s.get("advice_en"),
            "advice_bn": s2s.get("advice_bn"),
        },
        "metrics": {
            "monthly_income": tk(metrics.get("monthly_income_paisa")),
            "monthly_income_display": metrics.get("monthly_income_display"),
            "monthly_spend": monthly_spend,
            "monthly_spend_display": metrics.get("monthly_spend_display"),
            "savings_rate": metrics.get("savings_rate"),
            "buffer_days": metrics.get("buffer_days"),
            "cash_dependency_ratio": metrics.get("cash_dependency_ratio"),
            "fee_leakage": (
                tk(metrics.get("fee_leakage_paisa")) / monthly_spend
                if monthly_spend else 0.0
            ),
            "fixed_commitment_ratio": metrics.get("fixed_commitment_ratio"),
            "income_volatility": metrics.get("income_volatility"),
        },
        "recurring": {
            "inflows": [
                {
                    "label": it.get("title_en") or it.get("category"),
                    "cadence": it.get("periodicity"),
                    "dom": it.get("expected_day_of_month"),
                    "amount": tk(it.get("amount_paisa")),
                }
                for it in rec.get("inflows", [])
            ],
            "outflows": [
                {
                    "label": it.get("title_en") or it.get("category"),
                    "cadence": it.get("periodicity"),
                    "dom": it.get("expected_day_of_month"),
                    "amount": tk(it.get("amount_paisa")),
                }
                for it in rec.get("outflows", [])
            ],
            "upcoming_commitments_14d": tk(rec.get("upcoming_commitments_14d_paisa")),
        },
        "forecast": {
            "horizon_days": f.get("horizon_days"),
            "shortfall_prob": f.get("shortfall_prob"),
            "shortfall_prob_display": f.get("shortfall_prob_display"),
            "risk_level": f.get("risk_level"),
            "days_to_next_income": f.get("days_to_next_income"),
            "trough_date": f.get("trough_date"),
            "daily_quantiles": [
                {
                    "d": i + 1,
                    "p10": tk(day.get("p10_paisa")),
                    "p50": tk(day.get("p50_paisa")),
                    "p90": tk(day.get("p90_paisa")),
                }
                for i, day in enumerate(f.get("days", []))
            ],
        },
        "cashout_audit": {
            "total_fees": tk(co.get("total_fees_paisa")),
            "replaceable_fee_saved": tk(co.get("replaceable_fee_saved_paisa")),
            "annualized_savings": tk(co.get("annualized_savings_paisa", 0) or 0)
            or round(tk(co.get("replaceable_fee_saved_paisa")) * 12, 2),
            "patterns": [
                {
                    "agent": pat.get("counterparty_id"),
                    "count": pat.get("count"),
                    "fee_saved": tk(pat.get("replaceable_fee_saved_paisa")),
                }
                for pat in co.get("patterns", [])
            ],
        },
        "goal_plan": {
            "target": tk(gp.get("target_paisa")),
            "verdict": gp.get("verdict"),
            "feasibility_note_en": gp.get("feasibility_note_en"),
            "feasibility_note_bn": gp.get("feasibility_note_bn"),
            "options": [
                {
                    "monthly_contribution": tk(o.get("monthly_contribution_paisa")),
                    "months": o.get("months"),
                    "tradeoff_en": o.get("tradeoff_en"),
                    "tradeoff_bn": o.get("tradeoff_bn"),
                }
                for o in gp.get("options", [])
            ],
        },
        "categories": [
            {
                "category": c.get("category"),
                "total": tk(c.get("total_paisa")),
                "share": c.get("share"),
            }
            for c in s.get("categories", [])
        ],
        "weekly_outflows": _weekly_outflows(txns),
        # Raw transactions power the on-device deterministic engine.
        "engine": eng,
    }


def main() -> None:
    template = TEMPLATE.read_text(encoding="utf-8")
    for placeholder in ("__REASON__", "__ATTEMPT__", "__PERSONAS_JSON__"):
        assert placeholder in template, f"template lost placeholder {placeholder}"

    personas = []
    for name in ORDER:
        path = ROOT / "web" / "public" / "demo" / f"{name}.json"
        personas.append(flatten(json.loads(path.read_text(encoding="utf-8"))))

    blob = json.dumps(personas, ensure_ascii=False, separators=(",", ":"))
    # Guard against the blob terminating the host <script> tag early.
    blob = blob.replace("</", "<\\/")

    out = template.replace("__PERSONAS_JSON__", blob)
    assert "__REASON__" in out and "__ATTEMPT__" in out, "runtime placeholders must survive"
    assert "__PERSONAS_JSON__" not in out

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(out, encoding="utf-8")
    print(f"wrote {DEST.relative_to(ROOT)} ({DEST.stat().st_size / 1024:.1f} KB, {len(personas)} personas)")


if __name__ == "__main__":
    main()
