"""AI vs baseline benchmark view, derived only from docs/metrics/eval.json.

No metric is typed by hand here. `python -m ml.evaluate` computes every
number from the frozen test split and writes eval.json; this module only
re-shapes those numbers for the API (/v1/me/benchmark) and the demo bundle.
A metric that eval.json does not contain is omitted, never filled in.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

METRICS_DIR = Path(__file__).parent.parent / "docs" / "metrics"
EVAL_FILE = METRICS_DIR / "eval.json"
BENCHMARK_FILE = METRICS_DIR / "benchmark.json"

LABEL = "SIMULATED — synthetic data only; real validation requires governed data"


def _num(x: Any) -> float | None:
    return float(x) if isinstance(x, (int, float)) and x == x else None


def _f1(p: float | None, r: float | None) -> float | None:
    if p is None or r is None or (p + r) == 0:
        return None
    return 2 * p * r / (p + r)


def _drop_none(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


# Plain-language names for model features (labels only, never metrics).
FEATURE_LABELS = {
    "irr_out_last1": ("গতকালের খরচ", "Yesterday's spending"),
    "irr_out_last2": ("দুই দিন আগের খরচ", "Spending two days ago"),
    "irr_out_last3": ("তিন দিন আগের খরচ", "Spending three days ago"),
    "irr_net_7": ("গত ৭ দিনের নিট প্রবাহ", "Last 7 days' net flow"),
    "irr_net_30": ("গত ৩০ দিনের নিট প্রবাহ", "Last 30 days' net flow"),
    "irr_net_90": ("গত ৯০ দিনের নিট প্রবাহ", "Last 90 days' net flow"),
    "irr_net_std_30": ("আয়-ব্যয়ের ওঠানামা", "Day-to-day volatility"),
    "irr_out_7": ("সাম্প্রতিক খরচের গড়", "Recent average spending"),
    "irr_out_30": ("মাসিক খরচের গড়", "Monthly average spending"),
    "irr_in_7": ("সাম্প্রতিক দৈনিক আয়", "Recent daily earnings"),
    "irr_in_30": ("মাসিক দৈনিক আয়", "Monthly daily earnings"),
    "no_income_share_30": ("আয়হীন দিনের অংশ", "Share of days without income"),
    "days_since_income": ("শেষ আয়ের পর কত দিন", "Days since last income"),
    "days_to_income": ("পরবর্তী আয় পর্যন্ত দিন", "Days until next income"),
    "income_period_days": ("আয়ের চক্র", "Income cycle length"),
    "cash_est": ("হাতে থাকা আনুমানিক নগদ", "Estimated cash in hand"),
    "cash_tc_days": ("নগদ টাকা কত দিন চলে", "How long cash lasts"),
    "cashout_7": ("সাম্প্রতিক ক্যাশ-আউট", "Recent cash-outs"),
    "days_since_cashout": ("শেষ ক্যাশ-আউটের পর দিন", "Days since last cash-out"),
    "balance_scaled": ("বর্তমান ব্যালেন্স", "Current balance"),
    "balance_days_cover": ("ব্যালেন্সে কত দিন চলবে", "Days the balance covers"),
    "dom_irr_profile": ("মাসের দিনভিত্তিক খরচের ধরন", "Day-of-month spending pattern"),
    "dow": ("সপ্তাহের দিন", "Day of week"),
    "dom": ("মাসের তারিখ", "Day of month"),
    "k": ("কত দিন সামনে", "Days ahead"),
    "is_festival": ("উৎসবের সময়", "Festival period"),
    "is_month_end": ("মাসের শেষ সপ্তাহ", "Month-end week"),
    "inflow_cv_90": ("আয়ের অনিয়মিততা", "Income irregularity"),
    "log_scale": ("লেনদেনের আকার", "Typical transaction size"),
    "lifetime_days": ("ইতিহাসের দৈর্ঘ্য", "Length of history"),
}


def _f1_of(m: dict) -> float | None:
    return _f1(_num(m.get("precision")), _num(m.get("recall")))


def build_benchmark(ev: dict[str, Any]) -> dict[str, Any]:
    """Map an eval.json payload to the benchmark view. Pure."""
    fc = ev.get("forecast", {})
    sf = ev.get("shortfall", {})
    methods = sf.get("overall", {}).get("methods", {})
    model, boot, rule = methods.get("model", {}), methods.get("bootstrap", {}), methods.get("rule", {})

    brier = _drop_none({
        "ml_model": _num(model.get("brier")),
        "bootstrap_baseline": _num(boot.get("brier")),
        "rule_baseline": _num(rule.get("brier")),
        "base_rate_baseline": _num(methods.get("base_rate", {}).get("brier")),
        "brier_skill_score": _num(model.get("brier_skill_vs_base_rate")),
        "brier_skill_vs_bootstrap": _num(model.get("brier_skill_vs_bootstrap")),
        "brier_skill_vs_rule": _num(model.get("brier_skill_vs_rule")),
    })
    rows = {r["name"]: r for r in fc.get("table", [])}
    model_row = fc.get("table", [{}])[0] if fc.get("table") else {}
    base_rows = [r for n, r in rows.items() if n.startswith("B")]
    best = min(base_rows, key=lambda r: r["pinball"]) if base_rows else {}
    quantile = _drop_none({
        "pinball_ml": _num(model_row.get("pinball")),
        "pinball_best_baseline": _num(best.get("pinball")),
        "best_baseline": best.get("name"),
        "improvement": _num(fc.get("pinball_improvement_vs_best_baseline")),
    })
    wape = _drop_none({
        "wape_ml": _num(model_row.get("wape_p50")),
        "wape_best_baseline": _num(min((r["wape_p50"] for r in base_rows), default=None)),
        "coverage_p10_p90": _num(model_row.get("coverage_p10_p90")),
        "coverage_28d_cumulative": _num(model_row.get("coverage_28d_cum")),
    })
    ew = _drop_none({
        "ml_precision": _num(model.get("precision")), "ml_recall": _num(model.get("recall")),
        "ml_f1": _f1_of(model), "ml_pr_auc": _num(model.get("pr_auc")),
        "baseline_precision": _num(boot.get("precision")), "baseline_recall": _num(boot.get("recall")),
        "baseline_f1": _f1_of(boot), "baseline_pr_auc": _num(boot.get("pr_auc")),
        "recall_at_precision_0_6": _num(model.get("recall_at_precision_0_6")),
    })
    top = []
    for r in ev.get("shap", {}).get("global", [])[:5]:
        bn, en = FEATURE_LABELS.get(r["feature"], (r["feature"], r["feature"]))
        top.append({"feature": r["feature"], "importance_pct": round(100 * r["share"], 1),
                    "description_bn": bn, "description_en": en})

    return {
        "title": "AI model vs rule baselines",
        "description": "Every value is computed by `python -m ml.evaluate` on the frozen "
                       "held-out test users; metrics not yet computed are omitted.",
        "brier_score": brier,
        "quantile_loss": quantile,
        "wape_accuracy": wape,
        "early_warning_7d": ew,
        "interpretability": {"top_features": top, "method": "mean |SHAP| on the p50 model" if top else None},
        "governance_note": LABEL + f" · model {ev.get('model_version', 'unknown')}",
    }


def load_benchmark_metrics() -> dict[str, Any]:
    """Benchmark view of the current eval.json (empty sections if missing)."""
    ev: dict[str, Any] = {}
    if EVAL_FILE.exists():
        ev = json.loads(EVAL_FILE.read_text(encoding="utf-8"))
    return build_benchmark(ev)


def save_benchmark_metrics() -> None:
    """Write docs/metrics/benchmark.json from eval.json."""
    BENCHMARK_FILE.parent.mkdir(parents=True, exist_ok=True)
    BENCHMARK_FILE.write_text(json.dumps(load_benchmark_metrics(), indent=2, ensure_ascii=False),
                              encoding="utf-8")


if __name__ == "__main__":
    save_benchmark_metrics()
    print(f"Saved benchmark to {BENCHMARK_FILE}")
