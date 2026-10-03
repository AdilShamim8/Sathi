"""`python -m ml.evaluate` — evaluation on the frozen held-out test users.

Every number in docs/metrics/eval.json, docs/metrics/benchmark.json and
docs/eval_report.md is produced here (no hand-typed metrics). All results are
SIMULATED: the synthetic generator injects the patterns the model learns, so
they are sanity checks of the pipeline, not claims about real customers.

Tables (docs/ML_PLAN.md §5):
  T1 forecast   — irregular daily flow: model vs B1 seasonal naive, B2 user's
                  own 90-day empirical quantiles, B3 zero; pinball, WAPE,
                  daily and 28-day cumulative coverage before/after calibration
  T2 shortfall  — P(balance < personal floor within 7 days): model vs the
                  previous production bootstrap, a balance/spend rule and the
                  base rate; Brier, skill, PR-AUC, recall at precision >= 0.6
  T3 fairness   — T2 per persona and income band (persona used for audit only)
Alert cutoffs are chosen on validation users only.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, precision_recall_curve

from core.simulation import (
    block_correlated_uniforms,
    inverse_cdf,
    simulate_balance_paths,
)
from ml.inference import Forecaster, recalibrate, stable_seed
from ml.panel import FEATURES, TAUS, OriginFeatures, festival_window, load_panels
from ml.train import HORIZON, full_horizon_rows, load_dataset, pinball, split_users
from sathi_config import load_config

DOCS = Path(__file__).parent.parent / "docs"
METRICS_DIR = DOCS / "metrics"
LABEL = "SIMULATED — synthetic data only; real validation requires governed data"
N_PATHS = 500
CUM_DAYS = 28


# --------------------------------------------------------------------- T1
def _wape(y: np.ndarray, p: np.ndarray) -> float:
    d = np.abs(y).sum()
    return float(np.abs(y - p).sum() / d) if d > 0 else float("nan")


def _baseline_quantiles(panels, rows: pd.DataFrame) -> dict[str, np.ndarray]:
    """Scale-free baseline quantiles for each (user, origin, k) row."""
    b1 = np.zeros((len(rows), len(TAUS)))
    b2 = np.zeros((len(rows), len(TAUS)))
    cache: dict[tuple, np.ndarray] = {}
    for j, (u, d0, k, s) in enumerate(zip(rows["user_id"], rows["origin"], rows["k"], rows["scale"])):
        p = panels[u]
        i = p.index_of(d0)
        key = (u, d0)
        if key not in cache:
            hist = p.irr_net[max(i - 89, 0): i + 1] / s
            cache[key] = np.quantile(hist, TAUS)
        b2[j] = cache[key]
        # B1 seasonal naive: same weekday, 4 weeks before the target day
        # (always <= origin since k <= 28 would be needed; else 8 weeks).
        lag = 28 if k <= 28 else 56
        src = i + int(k) - lag
        b1[j] = p.irr_net[src] / s if src >= 0 else 0.0
    return {"B1 seasonal naive (same weekday, 4 wk ago)": b1,
            "B2 user's 90-day empirical quantiles": b2,
            "B3 zero irregular flow": np.zeros_like(b1)}


def _cum_coverage(rows: pd.DataFrame, q: np.ndarray, rho: float, block: int, seed: int,
                  days: int = CUM_DAYS, n: int = 400) -> tuple[float, float]:
    """Coverage of the 80% band and CRPS of the `days`-day cumulative flow."""
    rng = np.random.default_rng(seed)
    hits, crps = [], []
    y = rows["target"].to_numpy()
    for idx in rows.groupby(["user_id", "origin"]).indices.values():
        idx = np.sort(idx)[:days]
        u = block_correlated_uniforms(n, len(idx), rho, block, rng)
        sims = inverse_cdf(q[idx], TAUS, u).sum(axis=1)
        actual = y[idx].sum()
        lo, hi = np.quantile(sims, [0.1, 0.9])
        hits.append(lo <= actual <= hi)
        crps.append(np.mean(np.abs(sims - actual)) - 0.5 * np.mean(np.abs(sims - rng.permutation(sims))))
    return float(np.mean(hits)), float(np.mean(crps))


def forecast_eval(fc: Forecaster, panels, festival, first_origin, as_of, seed) -> dict:
    rows = full_horizon_rows(panels, festival, first_origin, as_of, HORIZON, 7)
    X = rows[FEATURES].to_numpy(dtype=float)
    y = rows["target"].to_numpy(dtype=float)
    scale = rows["scale"].to_numpy(dtype=float)
    q_raw = fc.quantiles(X, conformal=False)
    q_cal = fc.quantiles(X, conformal=True)
    rho = float(fc.calibration["rho"])
    block = int(fc.calibration["block_days"])

    def row(name, q, cum=None):
        r = {"name": name, "pinball": pinball(y, q),
             "wape_p50": _wape(y * scale, q[:, 4] * scale),
             "coverage_p10_p90": float(np.mean((y >= q[:, 0]) & (y <= q[:, -1])))}
        if cum is not None:
            r["coverage_28d_cum"], r["crps_28d_cum"] = cum
        return r

    table = [
        row("Model (LightGBM quantile, calibrated)", q_cal, _cum_coverage(rows, q_cal, rho, block, seed)),
        row("Model, no conformal widening", q_raw, _cum_coverage(rows, q_raw, rho, block, seed)),
        row("Model, independent days (rho = 0)", q_cal, _cum_coverage(rows, q_cal, 0.0, block, seed)),
    ]
    for name, qb in _baseline_quantiles(panels, rows).items():
        cum = _cum_coverage(rows, qb, 0.0, block, seed) if name.startswith("B2") else None
        table.append(row(name, qb, cum))
    best_base = min(r["pinball"] for r in table if r["name"].startswith("B"))
    return {
        "unit": "daily irregular net flow / user scale (scale-free)",
        "n_rows": len(rows), "n_origins": int(rows.groupby(["user_id", "origin"]).ngroups),
        "horizon_days": HORIZON, "cum_days": CUM_DAYS,
        "table_columns": ["pinball", "wape_p50", "coverage_p10_p90", "coverage_28d_cum", "crps_28d_cum"],
        "table": table,
        "pinball_improvement_vs_best_baseline": 1 - table[0]["pinball"] / best_base,
        "rho": rho, "conformal_widen_scaled": float(fc.calibration["conformal_widen_scaled"]),
    }


# --------------------------------------------------------------------- T2
def _rule_and_bootstrap(p, i, floor, lead, fb: OriginFeatures, sim_cfg, seed) -> tuple[float, float]:
    """Baselines at origin i. Rule: wallet / mean daily outflow (30 d) is
    shorter than min(days to income, lead). Bootstrap: the previous production
    method (block bootstrap of raw daily nets, no model)."""
    bal = float(p.eod_balance[i])
    out30 = float(np.mean(p.out_total[max(i - 29, 0): i + 1]))
    timing = fb.origin_state(i)["_timing"]
    to_income = timing.days_to_next_income + 1
    rule = 1.0 if (bal - floor) / max(out30, 1.0) < min(to_income, lead) else 0.0
    net = (p.irr_net + p.sched_net)[max(i - 89, 0): i + 1]
    rng = np.random.default_rng(seed)
    paths = simulate_balance_paths(np.rint(net).astype(np.int64), int(bal), lead,
                                   int(sim_cfg["block_length_days"]), N_PATHS, rng)
    boot = float(np.mean(paths[:, 1:].min(axis=1) < floor))
    return rule, boot


def shortfall_frame(fc: Forecaster, panels, festival, cfg, first_origin: dt.date, as_of: dt.date,
                    persona_of, band_of, seed: int, baselines: bool = True,
                    **forecast_kw) -> pd.DataFrame:
    th = cfg.section("thresholds")
    lead = int(th["shortfall_alert_lead_days"])
    floor_days = int(th["shortfall_floor_days"])
    sim_cfg = cfg.section("simulation")
    out = []
    for u, p in sorted(panels.items()):
        fb = OriginFeatures(p, festival)
        d0 = first_origin
        while d0 + dt.timedelta(days=lead) <= as_of:
            i = p.index_of(d0)
            if i >= 30 and not np.isnan(p.eod_balance[i]):
                floor = fb.floor(i, floor_days)
                if p.eod_balance[i] >= floor:
                    label = bool((p.eod_balance[i + 1: i + lead + 1] < floor).any())
                    f = fc.forecast_panel(p, d0, lead, festival=festival, floor_days=floor_days,
                                          n_paths=N_PATHS, seed=stable_seed(seed, u, d0),
                                          window_days=lead, **forecast_kw)
                    rule, boot = _rule_and_bootstrap(p, i, floor, lead, fb, sim_cfg,
                                                     stable_seed(seed, "boot", u, d0))                         if baselines else (np.nan, np.nan)
                    out.append({"user_id": u, "origin": d0, "label": label, "p_model": f.p_shortfall,
                                "p_bootstrap": recalibrate(boot, fc.calibration.get("bootstrap_platt"))
                                if baselines else np.nan, "p_rule": rule,
                                "persona": persona_of[u], "income_band": band_of[u]})
            d0 += dt.timedelta(days=7)
    return pd.DataFrame(out)


def _brier(p, y) -> float:
    return float(np.mean((np.asarray(p, float) - np.asarray(y, float)) ** 2))


def _recall_at_precision(y, p, min_precision=0.6) -> float | None:
    if y.sum() == 0:
        return None
    prec, rec, _ = precision_recall_curve(y, p)
    ok = rec[prec >= min_precision]
    return float(ok.max()) if ok.size else 0.0


def _best_f1_cutoff(y: np.ndarray, p: np.ndarray) -> float:
    best, cut = -1.0, 0.5
    for c in np.arange(0.05, 0.96, 0.05):
        pr = p >= c
        tp, fp, fn = (pr & y).sum(), (pr & ~y).sum(), (~pr & y).sum()
        f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) else 0.0
        if f1 > best:
            best, cut = f1, float(c)
    return round(cut, 2)


def score_shortfall(df: pd.DataFrame, base_rate: float, cutoffs: dict[str, float]) -> dict:
    y = df["label"].to_numpy(dtype=bool)
    res: dict = {"n": len(df), "base_rate": float(y.mean()) if len(y) else None, "methods": {}}
    b_clim = _brier(np.full(len(y), base_rate), y)
    for m, col in (("model", "p_model"), ("bootstrap", "p_bootstrap"), ("rule", "p_rule")):
        p = df[col].to_numpy(dtype=float)
        b = _brier(p, y)
        pr = p >= cutoffs.get(m, 0.5)
        tp, fp, fn = int((pr & y).sum()), int((pr & ~y).sum()), int((~pr & y).sum())
        res["methods"][m] = {
            "brier": b,
            "brier_skill_vs_base_rate": 1 - b / b_clim if b_clim > 0 else None,
            "pr_auc": float(average_precision_score(y, p)) if 0 < y.sum() < len(y) else None,
            "recall_at_precision_0_6": _recall_at_precision(y, p),
            "cutoff": cutoffs.get(m, 0.5),
            "recall": tp / (tp + fn) if (tp + fn) else None,
            "precision": tp / (tp + fp) if (tp + fp) else None,
        }
    res["methods"]["base_rate"] = {"brier": b_clim}
    mb = res["methods"]["model"]["brier"]
    for ref in ("bootstrap", "rule"):
        rb = res["methods"][ref]["brier"]
        res["methods"]["model"][f"brier_skill_vs_{ref}"] = 1 - mb / rb if rb > 0 else None
    return res


def reliability(df: pd.DataFrame, col: str = "p_model", bins: int = 10) -> list[dict]:
    edges = np.linspace(0, 1, bins + 1)
    out = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (df[col] >= lo) & ((df[col] < hi) if hi < 1 else (df[col] <= hi))
        if m.sum():
            out.append({"bin": f"{lo:.1f}-{hi:.1f}", "mean_predicted": float(df.loc[m, col].mean()),
                        "observed": float(df.loc[m, "label"].mean()), "n": int(m.sum())})
    return out


def shortfall_eval(fc, cfg, tx, us, splits, festival, as_of, seed) -> tuple[dict, pd.DataFrame]:
    lead = int(cfg.section("thresholds")["shortfall_alert_lead_days"])
    test_days = int(cfg.section("dataset")["splits"]["time_test_days"])
    first_origin = as_of - dt.timedelta(days=test_days)
    persona_of = us.set_index("user_id")["persona"]
    band_of = us.set_index("user_id")["income_band"]
    val_ids = [u for u, s in splits.items() if s in ("val", "cal")]
    test_ids = [u for u, s in splits.items() if s == "test"]
    val = shortfall_frame(fc, load_panels(tx, val_ids, as_of), festival, cfg, first_origin, as_of,
                          persona_of, band_of, seed)
    test = shortfall_frame(fc, load_panels(tx, test_ids, as_of), festival, cfg, first_origin, as_of,
                           persona_of, band_of, seed)
    yv = val["label"].to_numpy(dtype=bool)
    cutoffs = {m: _best_f1_cutoff(yv, val[c].to_numpy()) for m, c in
               (("model", "p_model"), ("bootstrap", "p_bootstrap"))}
    cutoffs["rule"] = 0.5
    base = float(yv.mean())
    result = {
        "event": "end-of-day wallet balance below the personal floor within the lead window",
        "lead_days": lead, "floor_days": int(cfg.section("thresholds")["shortfall_floor_days"]),
        "n_val": len(val), "base_rate_val": base, "cutoffs_from_val": cutoffs,
        "overall": score_shortfall(test, base, cutoffs),
        "per_persona": {k: score_shortfall(g, base, cutoffs) for k, g in test.groupby("persona")},
        "per_income_band": {k: score_shortfall(g, base, cutoffs) for k, g in test.groupby("income_band")},
        "reliability_model": reliability(test),
        "reliability_bootstrap": reliability(test, "p_bootstrap"),
    }
    return result, test


# --------------------------------------------------------------------- T4
def robustness_eval(fc, cfg, tx, us, splits, festival, as_of, seed, cutoffs, base_rate) -> dict:
    """Same shortfall/forecast metrics under input-feature noise and on the
    drifted cohort (shifted income day, x2 volatility, x2 shocks; never
    trained on)."""
    test_days = int(cfg.section("dataset")["splits"]["time_test_days"])
    first = as_of - dt.timedelta(days=test_days)
    persona_of = us.set_index("user_id")["persona"]
    band_of = us.set_index("user_id")["income_band"]
    test_ids = [u for u, s in splits.items() if s == "test"]
    panels = load_panels(tx, test_ids, as_of)
    rows = []

    def add(name, df, panels_for_cov, **kw):
        sc = score_shortfall(df, base_rate, cutoffs)
        r = full_horizon_rows(panels_for_cov, festival, as_of - dt.timedelta(days=test_days + HORIZON),
                              as_of, HORIZON, 14)
        q = fc.quantiles(r[FEATURES].to_numpy(dtype=float))
        if kw.get("noise"):
            q = fc.quantiles(_noisy(r[FEATURES].to_numpy(dtype=float), kw["noise"], seed))
        y = r["target"].to_numpy()
        rows.append({"name": name, "n": sc["n"], "base_rate": sc["base_rate"],
                     "brier_model": sc["methods"]["model"]["brier"],
                     "brier_bootstrap": sc["methods"]["bootstrap"]["brier"],
                     "brier_skill_vs_base_rate": sc["methods"]["model"]["brier_skill_vs_base_rate"],
                     "pr_auc_model": sc["methods"]["model"]["pr_auc"],
                     "coverage_p10_p90": float(np.mean((y >= q[:, 0]) & (y <= q[:, -1])))})

    for noise in (0.0, 0.1, 0.2, 0.3):
        df = shortfall_frame(fc, panels, festival, cfg, first, as_of, persona_of, band_of, seed,
                             feature_noise=noise)
        add(f"Test users, feature noise ±{int(noise * 100)}%", df, panels, noise=noise)

    d_dir = Path(__file__).parent.parent / "data" / "drifted"
    if (d_dir / "transactions.parquet").exists():
        dtx, dus, _ = load_dataset(d_dir) if (d_dir / "dataset_meta.json").exists() else (
            pd.read_parquet(d_dir / "transactions.parquet"), pd.read_parquet(d_dir / "users.parquet"), None)
        dpanels = load_panels(dtx, dus["user_id"].tolist(), as_of)
        df = shortfall_frame(fc, dpanels, festival, cfg, first, as_of, dus.set_index("user_id")["persona"],
                             dus.set_index("user_id")["income_band"], seed)
        add("Drifted cohort (income day +4, volatility x2, shocks x2)", df, dpanels)
    return {"note": "Feature noise multiplies every continuous origin feature by (1 + noise x N(0,1)) "
                    "at prediction time. The drifted cohort was generated with shifted parameters and is "
                    "never used for training, early stopping or calibration. Cutoffs and base rate come "
                    "from validation users.",
            "rows": rows}


def _noisy(X: np.ndarray, noise: float, seed: int) -> np.ndarray:
    if noise <= 0:
        return X
    rng = np.random.default_rng(seed)
    cont = [FEATURES.index(c) for c in FEATURES if c not in ("k", "dow", "dom", "is_month_end", "is_festival")]
    X = X.copy()
    X[:, cont] *= 1 + noise * rng.standard_normal((X.shape[0], len(cont)))
    return X


# --------------------------------------------------------------------- T5
def ablation_eval(fc, cfg, tx, us, splits, festival, as_of, seed, base_rate, full_df) -> dict:
    test_days = int(cfg.section("dataset")["splits"]["time_test_days"])
    first = as_of - dt.timedelta(days=test_days)
    persona_of = us.set_index("user_id")["persona"]
    band_of = us.set_index("user_id")["income_band"]
    panels = load_panels(tx, [u for u, s in splits.items() if s == "test"], as_of)
    variants = [("Full model", None),
                ("− cash-on-hand features", {"use_cash": False}),
                ("− recurring-stream timing (scheduled money spread evenly)", {"use_streams": False}),
                ("− conformal widening", {"conformal": False}),
                ("− block correlation (independent days, rho = 0)", {"rho": 0.0})]
    rows = []
    full_brier = None
    for name, kw in variants:
        df = full_df if kw is None else shortfall_frame(
            fc, panels, festival, cfg, first, as_of, persona_of, band_of, seed, baselines=False, **kw)
        y = df["label"].to_numpy(dtype=bool)
        p = df["p_model"].to_numpy(dtype=float)
        b = _brier(p, y)
        full_brier = b if full_brier is None else full_brier
        rows.append({"name": name, "brier": b,
                     "brier_skill_vs_base_rate": 1 - b / _brier(np.full(len(y), base_rate), y),
                     "pr_auc": float(average_precision_score(y, p)) if 0 < y.sum() < len(y) else None,
                     "delta_brier_vs_full": b - full_brier})
    return {"note": "Shortfall Brier on the same test user-weeks with one component removed at a time.",
            "rows": rows, "cash_on_hand": cash_on_hand_eval(panels, as_of, first)}


def cash_on_hand_eval(panels, as_of: dt.date, first: dt.date) -> dict:
    """MAE of the cash-on-hand estimators vs the generator's hidden pocket."""
    truth = pd.read_parquet(Path(__file__).parent.parent / "data" / "cash_truth.parquet")
    truth = truth[truth["user_id"].isin(set(panels))]
    tmap = {(u, d): c for u, d, c in zip(truth["user_id"], truth["date"], truth["cash_paisa"])}
    e1, e2, e0 = [], [], []
    for u, p in sorted(panels.items()):
        fb = OriginFeatures(p, set())
        d0 = first
        while d0 <= as_of:
            i = p.index_of(d0)
            if i >= 30 and (u, d0) in tmap:
                true = tmap[(u, d0)]
                v1 = sum(a * max(0.0, 1 - (d0 - d).days / 7) for d, _, a in p.cashout_events
                         if 0 <= (d0 - d).days < 7)          # v1: linear 7-day decay, all cash-outs
                v2, _ = fb.cash_estimate(i)
                e1.append(abs(v1 - true)); e2.append(abs(v2 - true)); e0.append(abs(true))
            d0 += dt.timedelta(days=7)
    return {"n": len(e1), "mae_v1_taka": float(np.mean(e1)) / 100, "mae_v2_taka": float(np.mean(e2)) / 100,
            "mae_zero_taka": float(np.mean(e0)) / 100}


# --------------------------------------------------------------------- T6
def planner_backtest(cfg, panels, seed: int, as_of: dt.date) -> dict:
    """Goals at 5 difficulty levels per test user (k x median monthly surplus
    x 3 months), planned 3 months before as_of from history only; realised =
    the user's actual surplus would have covered the required monthly
    contribution (same rule as the planner's simulation)."""
    from core.planner import PlannerConfig, plan_goal
    pcfg = cfg.section("planner")
    config = PlannerConfig(n_simulations=int(pcfg["n_simulations"]),
                           horizon_cap_months=int(pcfg["horizon_cap_months"]),
                           min_monthly_contribution_paisa=int(pcfg["min_monthly_contribution_paisa"]),
                           likely_cutoff=float(pcfg["likely_cutoff"]),
                           uncertain_cutoff=float(pcfg["uncertain_cutoff"]))
    origin = as_of - dt.timedelta(days=90)
    stated, realised, users = [], [], 0
    for u, p in sorted(panels.items()):
        net = p.irr_net + p.sched_net
        inflow = p.irr_in + np.maximum(p.sched_net, 0)
        i0 = p.index_of(origin)
        if i0 < 120:
            continue
        hist = [net[j - 30:j].sum() for j in range(i0 + 1, 30, -30)][:6]
        hist_in = [inflow[j - 30:j].sum() for j in range(i0 + 1, 30, -30)][:6]
        fut = [net[i0 + 1 + 30 * m: i0 + 31 + 30 * m].sum() for m in range(3)]
        med = float(np.median(hist))
        if med <= 0 or len(hist) < 3:
            continue
        users += 1
        for kk in (0.5, 0.8, 1.0, 1.3, 2.0):
            target = int(kk * med * 3)
            plan = plan_goal(target, 3, np.array(hist, dtype=np.int64), np.array(hist_in, dtype=np.int64),
                             0, 0, max_safe_contribution_paisa=int(med), config=config,
                             rng=np.random.default_rng(stable_seed(seed, u, kk)), as_of_date=origin)
            req = plan.monthly_required_paisa
            stated.append(plan.p_requested)
            realised.append(float(sum(min(req, max(f, 0)) for f in fut) >= target))
    s, r = np.array(stated), np.array(realised)
    bins, ece = [], 0.0
    for lo, hi in ((0, .2), (.2, .4), (.4, .6), (.6, .8), (.8, 1.0001)):
        m = (s >= lo) & (s < hi)
        if m.sum():
            bins.append({"bin": f"{lo:.1f}-{min(hi, 1):.1f}", "mean_stated": float(s[m].mean()),
                         "realised": float(r[m].mean()), "n": int(m.sum())})
            ece += m.sum() / len(s) * abs(s[m].mean() - r[m].mean())
    return {"note": "Planned 90 days before as_of; targets = k x median monthly surplus x 3 months, "
                    "k in {0.5, 0.8, 1.0, 1.3, 2.0}; users with non-positive median surplus are skipped.",
            "n_users": users, "n_goals": int(len(s)), "bins": bins, "ece": float(ece) if len(s) else None}


# --------------------------------------------------------------------- T7
def shap_eval(fc, panels, festival, as_of, seed, persona_of) -> dict:
    import shap
    first = as_of - dt.timedelta(days=60 + HORIZON)
    rows = full_horizon_rows(panels, festival, first, as_of, HORIZON, 14)
    rng = np.random.default_rng(seed)
    sample = rows.iloc[np.sort(rng.choice(len(rows), size=min(3000, len(rows)), replace=False))]
    X = sample[FEATURES].to_numpy(dtype=float)
    expl = shap.TreeExplainer(fc.boosters[0.5])
    sv = expl.shap_values(X)
    mean_abs = np.abs(sv).mean(axis=0)
    order = np.argsort(-mean_abs)
    glob = [{"feature": FEATURES[j], "mean_abs_shap": float(mean_abs[j]),
             "share": float(mean_abs[j] / mean_abs.sum())} for j in order[:10]]
    examples = []
    for persona in ("garment_worker", "gig_driver", "remittance_household"):
        cand = sample[(sample["user_id"].map(persona_of) == persona) & (sample["k"] == 7)]
        if cand.empty:
            continue
        r = cand.iloc[0]
        v = expl.shap_values(r[FEATURES].to_numpy(dtype=float)[None, :])[0]
        top = np.argsort(-np.abs(v))[:3]
        examples.append({"persona": persona, "origin": str(r["origin"]), "k": int(r["k"]),
                         "top": [{"feature": FEATURES[j], "shap": float(v[j])} for j in top]})
    return {"note": "TreeExplainer on the p50 model, 3,000 sampled test rows (scale-free units). "
                    "Persona is shown for the examples only; it is not a model input.",
            "global": glob, "examples": examples}


def reliability_plot(shortfall: dict, path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(4.8, 4.4), dpi=120)
    ax.plot([0, 1], [0, 1], color="#999", lw=1, ls="--", label="perfectly calibrated")
    for key, label, color in (("reliability_model", "model", "#1f6feb"),
                              ("reliability_bootstrap", "previous bootstrap", "#d29922")):
        pts = shortfall.get(key, [])
        if pts:
            ax.plot([p["mean_predicted"] for p in pts], [p["observed"] for p in pts], marker="o",
                    color=color, label=label)
    ax.set_xlabel("Predicted P(shortfall within 7 days)")
    ax.set_ylabel("Observed frequency")
    ax.set_title("Reliability — SIMULATED test users", fontsize=10)
    ax.legend(fontsize=8, loc="upper left")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


# --------------------------------------------------------------------- main
def main() -> None:
    cfg = load_config()
    ds = cfg.section("dataset")
    seed = int(ds["seed"])
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    tx, us, _ = load_dataset()
    splits = split_users(us["user_id"].tolist(), seed,
                         float(ds["splits"]["test_user_share"]), float(ds["splits"]["val_user_share"]))
    festival = festival_window(cfg)
    fc = Forecaster()
    test_ids = [u for u, s in splits.items() if s == "test"]
    first_origin = as_of - dt.timedelta(days=int(ds["splits"]["time_test_days"]) + HORIZON)

    forecast = forecast_eval(fc, load_panels(tx, test_ids, as_of), festival, first_origin, as_of, seed)
    shortfall, test_df = shortfall_eval(fc, cfg, tx, us, splits, festival, as_of, seed)
    persona_of = us.set_index("user_id")["persona"]
    test_panels = load_panels(tx, test_ids, as_of)
    # Per-persona daily coverage of the forecast band (fairness audit).
    rows = full_horizon_rows(test_panels, festival, first_origin, as_of, HORIZON, 7)
    q = fc.quantiles(rows[FEATURES].to_numpy(dtype=float))
    y = rows["target"].to_numpy()
    inside = (y >= q[:, 0]) & (y <= q[:, -1])
    shortfall["coverage_per_persona"] = {
        k: {"coverage": float(inside[g.index].mean()), "n": int(len(g))}
        for k, g in rows.assign(persona=rows["user_id"].map(persona_of)).groupby("persona")}
    cut, base = shortfall["cutoffs_from_val"], shortfall["base_rate_val"]
    robustness = robustness_eval(fc, cfg, tx, us, splits, festival, as_of, seed, cut, base)
    ablations = ablation_eval(fc, cfg, tx, us, splits, festival, as_of, seed, base, test_df)
    planner = planner_backtest(cfg, test_panels, seed, as_of)
    shap_res = shap_eval(fc, test_panels, festival, as_of, seed, persona_of)

    report = {"label": LABEL, "model_version": fc.version, "n_test_users": len(test_ids),
              "forecast": forecast, "shortfall": shortfall, "robustness": robustness,
              "ablations": ablations, "planner_backtest": planner, "shap": shap_res}
    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    (METRICS_DIR / "eval.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    reliability_plot(shortfall, METRICS_DIR / "reliability.png")
    from ml.benchmark import save_benchmark_metrics
    from ml.report import main as write_report
    save_benchmark_metrics()
    write_report()
    m = shortfall["overall"]["methods"]
    print(json.dumps({
        "pinball_model": round(forecast["table"][0]["pinball"], 4),
        "pinball_gain_vs_best_baseline": round(forecast["pinball_improvement_vs_best_baseline"], 4),
        "daily_cov_raw_vs_cal": [round(forecast["table"][1]["coverage_p10_p90"], 3),
                                 round(forecast["table"][0]["coverage_p10_p90"], 3)],
        "cum28_cov": round(forecast["table"][0]["coverage_28d_cum"], 3),
        "brier_model_boot_rule": [round(m[k]["brier"], 4) for k in ("model", "bootstrap", "rule")],
        "bss_vs_base_rate": round(m["model"]["brier_skill_vs_base_rate"], 3),
        "pr_auc_model_boot": [m["model"]["pr_auc"], m["bootstrap"]["pr_auc"]],
        "recall_at_p06": m["model"]["recall_at_precision_0_6"],
    }, indent=2, default=str))


if __name__ == "__main__":
    main()
