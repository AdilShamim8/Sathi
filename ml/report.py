"""Render docs/eval_report.md from docs/metrics/eval.json (no hand-typed numbers).

`python -m ml.report` (also called at the end of `python -m ml.evaluate`).
Every number in the report is read from eval.json; a section whose metrics are
missing says so instead of showing a placeholder.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DOCS = Path(__file__).parent.parent / "docs"
EVAL_FILE = DOCS / "metrics" / "eval.json"
REPORT_FILE = DOCS / "eval_report.md"


def fmt(x: Any, nd: int = 3, pct: bool = False) -> str:
    if x is None or (isinstance(x, float) and x != x):
        return "n/a"
    if isinstance(x, bool):
        return str(x)
    if isinstance(x, (int, float)):
        if pct:
            return f"{100 * x:.1f}%"
        return f"{x:.{nd}f}" if isinstance(x, float) else str(x)
    return str(x)


def table(headers: list[str], rows: list[list[Any]]) -> str:
    out = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def _t1(fc: dict) -> list[str]:
    if not fc or "table" not in fc:
        return ["_Not computed._"]
    cols = fc["table_columns"]
    names = {"pinball": "Pinball (lower better)", "wape_p50": "WAPE of p50",
             "coverage_p10_p90": "Daily p10–p90 coverage", "coverage_28d_cum": "28-day cum. 80% coverage",
             "crps_28d_cum": "28-day cum. CRPS"}
    rows = [[r["name"]] + [fmt(r.get(c), pct=c.startswith("coverage")) for c in cols] for r in fc["table"]]
    return [
        f"Unit: {fc['unit']}. {fmt(fc['n_origins'])} test forecast origins × {fmt(fc['horizon_days'])} days "
        f"({fmt(fc['n_rows'])} rows). Nominal coverage is 80%.",
        "",
        table(["Method"] + [names.get(c, c) for c in cols], rows),
        "",
        f"Pinball improvement over the best baseline: {fmt(fc.get('pinball_improvement_vs_best_baseline'), pct=True)}. "
        f"Calibration (fitted on calibration users only): conformal widening "
        f"{fmt(fc.get('conformal_widen_scaled'))} (scaled units), within-week correlation rho = {fmt(fc.get('rho'), 1)}.",
    ]


def _methods_rows(res: dict, label: str) -> list[list[str]]:
    rows = []
    for m in ("model", "bootstrap", "rule"):
        v = res["methods"].get(m, {})
        rows.append([label, m, fmt(v.get("brier"), 4), fmt(v.get("brier_skill_vs_base_rate")),
                     fmt(v.get("pr_auc")), fmt(v.get("recall_at_precision_0_6")),
                     fmt(v.get("recall")), fmt(v.get("precision"))])
    return rows


METHOD_NOTE = ("Methods: **model** = LightGBM quantile forecaster + recurring streams + calibrated paths; "
               "**bootstrap** = the previous production method (block bootstrap of the user's raw daily "
               "nets, no model); **rule** = wallet ÷ average daily outflow shorter than the days to "
               "income (0/1). Brier skill is relative to always predicting the validation base rate.")
HEAD = ["Group", "Method", "Brier", "Brier skill", "PR-AUC", "Recall @ precision ≥ 0.6", "Recall", "Precision"]


def _t2(sf: dict) -> list[str]:
    if not sf or "overall" not in sf:
        return ["_Not computed._"]
    o = sf["overall"]
    mm = o["methods"]["model"]
    lines = [
        f"Event: {sf['event']} ({fmt(sf['lead_days'])} days; floor = {fmt(sf['floor_days'])} days of the user's "
        f"median daily outflow). Test: {fmt(o['n'])} user-weeks, base rate {fmt(o['base_rate'], pct=True)}. "
        f"Alert cutoffs chosen on {fmt(sf['n_val'])} validation user-weeks: {sf['cutoffs_from_val']}.",
        "", METHOD_NOTE, "",
        table(HEAD, _methods_rows(o, "All test users")),
        "",
        f"Model Brier skill vs the previous bootstrap: {fmt(mm.get('brier_skill_vs_bootstrap'))}; "
        f"vs the rule: {fmt(mm.get('brier_skill_vs_rule'))}.",
    ]
    rel = sf.get("reliability_model", [])
    if rel:
        lines += ["", "Reliability of the model probability (10 bins; a calibrated model has observed ≈ predicted):", "",
                  table(["Bin", "Mean predicted", "Observed", "n"],
                        [[r["bin"], fmt(r["mean_predicted"]), fmt(r["observed"]), fmt(r["n"])] for r in rel]),
                  "", "Plot: `docs/metrics/reliability.png`."]
    return lines


def _t3(sf: dict) -> list[str]:
    if not sf or "per_persona" not in sf:
        return ["_Not computed._"]
    rows = []
    for grp in ("per_persona", "per_income_band"):
        for k, v in sorted(sf[grp].items()):
            m = v["methods"]["model"]
            b = v["methods"]["bootstrap"]
            rows.append([k, fmt(v["n"]), fmt(v["base_rate"], pct=True), fmt(m.get("brier"), 4),
                         fmt(b.get("brier"), 4), fmt(m.get("brier_skill_vs_base_rate")),
                         fmt(m.get("recall")), fmt(m.get("precision"))])
    lines = ["Personas and income bands are used for this audit only, never as model inputs.", "",
             table(["Group", "n", "Base rate", "Brier model", "Brier bootstrap", "Brier skill", "Recall",
                    "Precision"], rows)]
    cov = sf.get("coverage_per_persona")
    if cov:
        lines += ["", "Daily p10–p90 coverage of the forecast per persona (nominal 80%):", "",
                  table(["Persona", "Coverage", "n rows"],
                        [[k, fmt(v["coverage"], pct=True), fmt(v["n"])] for k, v in sorted(cov.items())])]
    return lines


def _t4(rb: dict) -> list[str]:
    if not rb:
        return ["_Not computed._"]
    rows = [[r["name"], fmt(r.get("n")), fmt(r.get("base_rate"), pct=True), fmt(r.get("brier_model"), 4),
             fmt(r.get("brier_bootstrap"), 4), fmt(r.get("brier_skill_vs_base_rate")),
             fmt(r.get("pr_auc_model")), fmt(r.get("coverage_p10_p90"), pct=True)] for r in rb["rows"]]
    return [rb.get("note", ""), "",
            table(["Test set", "n", "Base rate", "Brier model", "Brier bootstrap", "Brier skill",
                   "PR-AUC", "Daily coverage"], rows)]


def _t5(ab: dict) -> list[str]:
    if not ab:
        return ["_Not computed._"]
    rows = [[r["name"], fmt(r["brier"], 4), fmt(r.get("brier_skill_vs_base_rate")), fmt(r.get("pr_auc")),
             fmt(r.get("delta_brier_vs_full"), 4)] for r in ab["rows"]]
    lines = [ab.get("note", ""), "", table(["Variant", "Brier", "Brier skill", "PR-AUC", "Δ Brier vs full"], rows)]
    coh = ab.get("cash_on_hand")
    if coh:
        lines += ["", f"Cash-on-hand estimator vs hidden ground truth ({fmt(coh['n'])} test user-days): "
                      f"MAE v1 (linear 7-day decay) {fmt(coh['mae_v1_taka'], 0)} taka, "
                      f"v2 (per-user decay, stream-aware) {fmt(coh['mae_v2_taka'], 0)} taka, "
                      f"always-zero {fmt(coh['mae_zero_taka'], 0)} taka."]
    return lines


def _t6(pl: dict) -> list[str]:
    if not pl or "bins" not in pl:
        return ["_Not computed._"]
    rows = [[b["bin"], fmt(b["mean_stated"]), fmt(b["realised"]), fmt(b["n"])] for b in pl["bins"]]
    return [pl.get("note", ""), "",
            table(["Stated P(goal) bin", "Mean stated", "Realised", "n goals"], rows), "",
            f"Expected calibration error (weighted |stated − realised|): {fmt(pl.get('ece'))}; "
            f"{fmt(pl.get('n_goals'))} goals from {fmt(pl.get('n_users'))} test users."]


def _t7(sh: dict) -> list[str]:
    if not sh or "global" not in sh:
        return ["_Not computed._"]
    rows = [[r["feature"], fmt(r["mean_abs_shap"], 4), fmt(r["share"], pct=True)] for r in sh["global"]]
    lines = [sh.get("note", ""), "", table(["Feature", "Mean |SHAP|", "Share"], rows)]
    for ex in sh.get("examples", []):
        lines += ["", f"Example — {ex['persona']} at {ex['origin']}, day +{ex['k']}: top drivers "
                  + ", ".join(f"{d['feature']} ({d['shap']:+.3f})" for d in ex["top"]) + "."]
    return lines


def render(ev: dict) -> str:
    parts = [
        "# Sathi — evaluation report",
        "",
        f"**{ev.get('label', 'SIMULATED')}**",
        "",
        "Generated by `python -m ml.evaluate` (or `make eval`) from the frozen held-out test users "
        f"({fmt(ev.get('n_test_users'))} users never used for training, early stopping or calibration). "
        "Do not edit by hand: every number below is read from `docs/metrics/eval.json`. "
        f"Model version: `{ev.get('model_version', 'unknown')}`.",
        "",
        "The data is synthetic and the generator injects the patterns the model learns, so these "
        "numbers are sanity checks of the pipeline, not accuracy claims about real customers.",
        "",
    ]
    sections = [
        ("T1 — Forecast of daily irregular flow", _t1(ev.get("forecast", {}))),
        ("T2 — Shortfall early warning", _t2(ev.get("shortfall", {}))),
        ("T3 — Fairness audit", _t3(ev.get("shortfall", {}))),
        ("T4 — Robustness", _t4(ev.get("robustness", {}))),
        ("T5 — Ablations", _t5(ev.get("ablations", {}))),
        ("T6 — Goal planner back-test", _t6(ev.get("planner_backtest", {}))),
        ("T7 — Explainability (SHAP)", _t7(ev.get("shap", {}))),
    ]
    for title, body in sections:
        parts += [f"## {title}", ""] + body + [""]
    return "\n".join(parts).rstrip() + "\n"


def main() -> None:
    ev = json.loads(EVAL_FILE.read_text(encoding="utf-8"))
    REPORT_FILE.write_text(render(ev), encoding="utf-8", newline="\n")
    print(f"wrote {REPORT_FILE}")


if __name__ == "__main__":
    main()
