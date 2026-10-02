"""`python -m ml.evaluate` — forecast and planner evaluation on held-out data.

Every metric is computed against a naive and a seasonal baseline, reported per
persona and income band, and labelled SIMULATED: the generator injects the
patterns the model learns, so these are sanity checks on synthetic data, not
accuracy claims about real upay customers. The frozen test users are used for
final numbers only; the alert cutoff is chosen on validation users only.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd

from core.planner import PlannerConfig, plan_goal
from core.simulation import shortfall_stats, simulate_balance_paths
from ml.features import (FEATURE_COLUMNS, build_feature_row, cashout_trailing,
                         daily_flows, dom_net_profile, obligation_days)
from ml.train import load_dataset, split_users
from sathi_config import load_config

DOCS = Path(__file__).parent.parent / "docs"
METRICS_DIR = DOCS / "metrics"


def _models() -> dict[float, lgb.Booster]:
    latest = json.loads((Path(__file__).parent / "artifacts" / "forecast" / "latest.json").read_text())
    folder = Path(__file__).parent / "artifacts" / "forecast" / latest["version"]
    out = {}
    for q in (0.1, 0.5, 0.9):
        out[q] = lgb.Booster(model_file=str(folder / f"model_q{int(q * 100)}.txt"))
    out["version"] = latest["version"]
    return out


def _predict(models, frame: pd.DataFrame) -> pd.DataFrame:
    X = frame[FEATURE_COLUMNS].to_numpy(dtype=float)
    frame = frame.copy()
    # Models predict the residual over the trailing mean net (see ml.train).
    base = frame["mean_net"].to_numpy(dtype=float)
    for q in (0.1, 0.5, 0.9):
        frame[f"p{int(q * 100)}"] = base + models[q].predict(X)
    return frame


def _weekly(frame: pd.DataFrame, pred_col: str, with_band: bool = True) -> pd.DataFrame:
    tmp = frame.assign(week=pd.to_datetime(frame["date"]).dt.to_period("W"))
    agg = dict(actual=("target_net_paisa", "sum"), pred=(pred_col, "sum"),
               persona=("persona", "first"), income_band=("income_band", "first"))
    if with_band:
        agg["p10"] = ("p10", "sum")
        agg["p90"] = ("p90", "sum")
    return tmp.groupby(["user_id", "week"]).agg(**agg).reset_index()


def _wape(actual: np.ndarray, pred: np.ndarray) -> float:
    denom = np.abs(actual).sum()
    return float(np.abs(actual - pred).sum() / denom) if denom > 0 else float("nan")


def forecast_eval(cfg, models, tx, us, splits) -> dict:
    ds = cfg.section("dataset")
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    time_test_days = int(ds["splits"]["time_test_days"])
    test_start = as_of - dt.timedelta(days=time_test_days) + dt.timedelta(days=1)
    window_start = dt.date.fromisoformat(ds["start_date"])
    personas_cfg = cfg.section("personas")
    festival = set(cfg.section("calendar")["festival_days"])

    test_users = {u for u, s in splits.items() if s == "test"}
    sub = tx[tx["user_id"].isin(test_users)].copy()
    flows = daily_flows(sub, window_start, as_of).merge(
        us[["user_id", "persona", "income_band"]], on="user_id")
    co = cashout_trailing(sub, window_start, as_of)
    flows = flows.merge(co, on=["user_id", "date"], how="left")
    for c in ("cashout_count_30d", "cashout_mean_30d", "days_since_cashout"):
        flows[c] = flows[c].fillna(30.0 if c == "days_since_cashout" else 0.0)

    rows = []
    for user_id, g in flows.groupby("user_id"):
        g = g.sort_values("date").reset_index(drop=True)
        g["net"] = g["inflow_paisa"] - g["outflow_paisa"]
        g["mean_in"] = g["inflow_paisa"].rolling(30, min_periods=10).mean().shift(1)
        g["mean_out"] = g["outflow_paisa"].rolling(30, min_periods=10).mean().shift(1)
        g["std_net"] = g["net"].rolling(30, min_periods=10).std().shift(1)
        g["mean_net"] = g["net"].rolling(30, min_periods=10).mean().shift(1)
        # Seasonal naive: mean of net on the same weekday over the trailing
        # 28 days (indices len-7, len-14, len-21, len-28 behind day t).
        def _seasonal(s: np.ndarray) -> float:
            idx = np.arange(len(s) - 7, -1, -7)
            return float(s[idx].mean()) if len(idx) else np.nan
        g["seasonal_pred"] = g["net"].rolling(28, min_periods=14).apply(_seasonal, raw=True).shift(1)
        persona = g["persona"].iloc[0]
        income_dom = None
        for stream in personas_cfg[persona]["income_streams"]:
            if "day_of_month" in stream:
                income_dom = int(stream["day_of_month"])
        obligations = obligation_days(sub[sub["user_id"] == user_id].assign(
            date=pd.to_datetime(sub[sub["user_id"] == user_id]["ts"], utc=True).dt.tz_convert("Asia/Dhaka").dt.date))
        # Profile frozen at the eval window start — the same information a
        # served model would have at the forecast origin.
        dom_profile = dom_net_profile(g[["date", "inflow_paisa", "outflow_paisa"]], test_start)
        for _, r in g.iterrows():
            d = r["date"]
            if d < test_start or pd.isna(r["mean_in"]):
                continue
            feats = build_feature_row(d, {"mean_in": r["mean_in"], "mean_out": r["mean_out"],
                                          "std_net": 0.0 if pd.isna(r["std_net"]) else r["std_net"],
                                          "mean_net": r["mean_net"], "n_days": 30,
                                          "cashout_count_30d": r["cashout_count_30d"],
                                          "cashout_mean_30d": r["cashout_mean_30d"],
                                          "days_since_cashout": r["days_since_cashout"]},
                                      income_dom, obligations, festival, persona,
                                      dom_profile=dom_profile)
            feats.update(user_id=user_id, date=d, target_net_paisa=r["net"],
                         persona=persona, income_band=g["income_band"].iloc[0],
                         naive_pred=r["mean_net"], seasonal_pred=r["seasonal_pred"])
            rows.append(feats)
    frame = _predict(models, pd.DataFrame(rows))

    w_model = _weekly(frame, "p50")
    w_naive = _weekly(frame, "naive_pred", with_band=False)[["user_id", "week", "pred"]].rename(columns={"pred": "naive"})
    seas = frame.dropna(subset=["seasonal_pred"])
    w_seas = _weekly(seas, "seasonal_pred", with_band=False)[["user_id", "week", "pred"]].rename(columns={"pred": "seasonal"})
    wk = w_model.merge(w_naive, on=["user_id", "week"]).merge(w_seas, on=["user_id", "week"], how="left")

    result = {
        "wape_model": _wape(wk["actual"].to_numpy(), wk["pred"].to_numpy()),
        "wape_naive": _wape(wk["actual"].to_numpy(), wk["naive"].to_numpy()),
        "wape_seasonal": _wape(wk.dropna(subset=["seasonal"])["actual"].to_numpy(),
                             wk.dropna(subset=["seasonal"])["seasonal"].to_numpy()),
        "coverage_p10_p90": float(((wk["actual"] >= wk["p10"]) & (wk["actual"] <= wk["p90"])).mean()),
        "n_weeks": int(len(wk)),
    }
    best_base = min(result["wape_naive"], result["wape_seasonal"])
    result["wape_improvement_vs_best_baseline"] = 1 - result["wape_model"] / best_base if best_base else None

    per_persona = {}
    for persona, grp in wk.groupby("persona"):
        per_persona[persona] = {
            "wape_model": _wape(grp["actual"].to_numpy(), grp["pred"].to_numpy()),
            "wape_naive": _wape(grp["actual"].to_numpy(), grp["naive"].to_numpy()),
            "n_weeks": int(len(grp)),
        }
    result["per_persona"] = per_persona
    per_band = {}
    for band, grp in wk.groupby("income_band"):
        per_band[band] = {"wape_model": _wape(grp["actual"].to_numpy(), grp["pred"].to_numpy()),
                          "wape_naive": _wape(grp["actual"].to_numpy(), grp["naive"].to_numpy())}
    result["per_income_band"] = per_band

    # Noise robustness: scale feature means by +/-20% and re-measure WAPE.
    robust = []
    for noise in (0.0, 0.1, 0.2, 0.3):
        noisy = frame.copy()
        for col in ("mean_in", "mean_out", "mean_net", "std_net", "dom_net_profile"):
            noisy[col] = noisy[col] * (1 + noise)
        wn = _weekly(_predict(models, noisy), "p50")
        robust.append({"feature_noise": noise,
                       "wape_model": _wape(wn["actual"].to_numpy(), wn["pred"].to_numpy())})
    result["noise_robustness"] = robust
    return result


def shortfall_eval(cfg, models, tx, us, splits) -> dict:
    """Early-warning recall/precision at a 7-day lead. Cutoff tuned on val."""
    ds = cfg.section("dataset")
    th = cfg.section("thresholds")
    sim_cfg = cfg.section("simulation")
    essentials = int(th["essentials_per_day_paisa"])
    horizon = int(th["shortfall_horizon_days"])
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    time_test_days = int(ds["splits"]["time_test_days"])
    test_start = as_of - dt.timedelta(days=time_test_days) + dt.timedelta(days=1)
    window_start = dt.date.fromisoformat(ds["start_date"])
    personas_cfg = cfg.section("personas")
    festival = set(cfg.section("calendar")["festival_days"])

    def p_shortfall_series(user_ids) -> pd.DataFrame:
        sub = tx[tx["user_id"].isin(user_ids)].copy()
        flows = daily_flows(sub, window_start, as_of)
        out = []
        for user_id, g in flows.groupby("user_id"):
            g = g.sort_values("date").reset_index(drop=True)
            g["net"] = g["inflow_paisa"] - g["outflow_paisa"]
            g["balance"] = g["net"].cumsum()
            persona = us.set_index("user_id").loc[user_id, "persona"]
            income_dom = None
            for stream in personas_cfg[persona]["income_streams"]:
                if "day_of_month" in stream:
                    income_dom = int(stream["day_of_month"])
            origins = [d for d in g["date"] if d >= test_start and (d - test_start).days % 7 == 0]
            for origin in origins:
                hist = g[g["date"] < origin].tail(90)
                if len(hist) < 30:
                    continue
                future = g[(g["date"] > origin) & (g["date"] <= origin + dt.timedelta(days=7))]
                if len(future) < 7:
                    continue
                label = bool((future["balance"] < essentials).any())
                dom_profile = dom_net_profile(g[["date", "inflow_paisa", "outflow_paisa"]], origin)
                feats = []
                for i in range(horizon):
                    d = origin + dt.timedelta(days=i + 1)
                    agg = {"mean_in": hist["inflow_paisa"].mean(), "mean_out": hist["outflow_paisa"].mean(),
                           "std_net": float(hist["net"].std()), "mean_net": hist["net"].mean(), "n_days": len(hist)}
                    feats.append(build_feature_row(d, agg, income_dom, {}, festival, persona,
                                                   dom_profile=dom_profile))
                X = pd.DataFrame(feats)[FEATURE_COLUMNS].to_numpy(dtype=float)
                mean_net_col = FEATURE_COLUMNS.index("mean_net")
                p50 = X[:, mean_net_col] + models[0.5].predict(X)
                residuals = (hist["net"].to_numpy(dtype=float) - np.repeat(hist["net"].mean(), len(hist)))
                rng = np.random.default_rng(int(ds["seed"]) + hash((user_id, origin)) % 100_000)
                paths = simulate_balance_paths(
                    residuals.astype(np.int64) + p50.mean().astype(np.int64),
                    int(g.loc[g["date"] == origin, "balance"].iloc[0]) if (g["date"] == origin).any() else 0,
                    horizon, int(sim_cfg["block_length_days"]), int(sim_cfg["n_paths"]), rng)
                days_to_income = horizon
                if income_dom is not None:
                    nxt = origin.replace(day=min(income_dom, 28))
                    if nxt <= origin:
                        nxt = (origin.replace(day=28) + dt.timedelta(days=8)).replace(day=min(income_dom, 28))
                    days_to_income = max((nxt - origin).days, 1)
                p, _, _ = shortfall_stats(paths, essentials, min(days_to_income, horizon))
                out.append({"user_id": user_id, "origin": origin, "label": label, "p_shortfall": p,
                            "persona": persona})
        return pd.DataFrame(out)

    val_users = [u for u, s in splits.items() if s == "val"]
    test_users = [u for u, s in splits.items() if s == "test"]
    val_df = p_shortfall_series(val_users)
    test_df = p_shortfall_series(test_users)

    # Cutoff on validation only: best F1.
    best_cut, best_f1 = 0.5, -1.0
    for cut in np.arange(0.1, 0.95, 0.05):
        pred = val_df["p_shortfall"] >= cut
        tp = int((pred & val_df["label"]).sum())
        fp = int((pred & ~val_df["label"]).sum())
        fn = int((~pred & val_df["label"]).sum())
        f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) else 0.0
        if f1 > best_f1:
            best_f1, best_cut = f1, float(cut)

    pred = test_df["p_shortfall"] >= best_cut
    tp = int((pred & test_df["label"]).sum())
    fp = int((pred & ~test_df["label"]).sum())
    fn = int((~pred & test_df["label"]).sum())
    recall = tp / (tp + fn) if (tp + fn) else None
    precision = tp / (tp + fp) if (tp + fp) else None
    per_persona = {}
    for persona, grp in test_df.groupby("persona"):
        pr = grp["p_shortfall"] >= best_cut
        t = int((pr & grp["label"]).sum()); f = int((pr & ~grp["label"]).sum()); m = int((~pr & grp["label"]).sum())
        per_persona[persona] = {
            "recall": (t / (t + m)) if (t + m) else None,
            "precision": (t / (t + f)) if (t + f) else None,
            "n": int(len(grp)),
        }
    return {"cutoff": best_cut, "recall": recall, "precision": precision,
            "lead_days": int(cfg.section("thresholds")["shortfall_alert_lead_days"]),
            "n_val": int(len(val_df)), "n_test": int(len(test_df)),
            "per_persona": per_persona}


def planner_backtest(cfg, tx, us, splits) -> dict:
    """Stated P(goal met) vs realized frequency on validation users."""
    ds = cfg.section("dataset")
    as_of = dt.date.fromisoformat(ds["as_of_date"])
    window_start = dt.date.fromisoformat(ds["start_date"])
    th = cfg.section("thresholds")
    essentials_monthly = int(th["essentials_per_day_paisa"]) * 30
    pcfg = cfg.section("planner")
    config = PlannerConfig(n_simulations=int(pcfg["n_simulations"]),
                           horizon_cap_months=int(pcfg["horizon_cap_months"]),
                           min_monthly_contribution_paisa=int(pcfg["min_monthly_contribution_paisa"]),
                           likely_cutoff=float(pcfg["likely_cutoff"]),
                           uncertain_cutoff=float(pcfg["uncertain_cutoff"]))

    origin = as_of - dt.timedelta(days=92)          # plan 3 months back
    horizon_days = 92
    val_users = [u for u, s in splits.items() if s == "val"]
    sub = tx[tx["user_id"].isin(val_users)].copy()
    flows = daily_flows(sub, window_start, as_of)

    stated, realized = [], []
    for user_id, g in flows.groupby("user_id"):
        g = g.sort_values("date")
        g["net"] = g["inflow_paisa"] - g["outflow_paisa"]
        g["month"] = pd.to_datetime(g["date"]).dt.to_period("M")
        monthly = g.groupby("month")["net"].sum()
        hist = monthly[monthly.index < pd.Period(origin, "M")]
        future = monthly[(monthly.index >= pd.Period(origin, "M"))].head(3)
        if len(hist) < 4 or len(future) < 3:
            continue
        pool = hist.to_numpy(dtype=np.int64)
        inflow_monthly = g[g["inflow_paisa"] > 0].groupby("month")["inflow_paisa"].sum()
        inflow_pool = inflow_monthly[inflow_monthly.index < pd.Period(origin, "M")].to_numpy(dtype=np.int64)
        if inflow_pool.size == 0:
            continue
        positive = pool[pool > 0]
        if positive.size == 0:
            continue
        target = int(np.median(positive) * 3)        # an achievable-ish 3-month goal
        if target <= 0:
            continue
        income_med = int(np.median(inflow_pool))
        plan = plan_goal(target, 3, pool, inflow_pool, 0, 0,
                         max_safe_contribution_paisa=max(income_med - essentials_monthly, 0),
                         config=config, rng=np.random.default_rng(int(ds["seed"])),
                         as_of_date=origin)
        # Realized: could the required contribution have been met each month?
        req = plan.monthly_required_paisa
        met = bool((np.minimum(req, np.maximum(future.to_numpy(), 0)).sum() >= target))
        stated.append(plan.p_requested)
        realized.append(met)
    stated_a = np.array(stated)
    realized_a = np.array(realized, dtype=float)
    buckets = {}
    for lo, hi in ((0.0, 0.33), (0.33, 0.66), (0.66, 1.01)):
        mask = (stated_a >= lo) & (stated_a < hi)
        if mask.sum() >= 5:
            buckets[f"{lo:.2f}-{min(hi, 1.0):.2f}"] = {
                "mean_stated": float(stated_a[mask].mean()),
                "realized": float(realized_a[mask].mean()),
                "n": int(mask.sum()),
            }
    gap = float(abs(stated_a.mean() - realized_a.mean())) if len(stated_a) else None
    return {"n_users": len(stated), "buckets": buckets,
            "mean_stated": float(stated_a.mean()) if len(stated_a) else None,
            "realized_rate": float(realized_a.mean()) if len(realized_a) else None,
            "calibration_gap": gap}


def main() -> None:
    cfg = load_config()
    ds = cfg.section("dataset")
    tx, us, meta = load_dataset()
    models = _models()
    splits = split_users(us["user_id"].tolist(), int(ds["seed"]),
                         float(ds["splits"]["test_user_share"]), float(ds["splits"]["val_user_share"]))

    METRICS_DIR.mkdir(parents=True, exist_ok=True)
    forecast = forecast_eval(cfg, models, tx, us, splits)
    shortfall = shortfall_eval(cfg, models, tx, us, splits)
    planner = planner_backtest(cfg, tx, us, splits)

    report = {
        "label": "SIMULATED — synthetic data only; real validation requires governed data",
        "model_version": models["version"],
        "forecast": forecast,
        "shortfall": shortfall,
        "planner_backtest": planner,
    }
    (METRICS_DIR / "eval.json").write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(json.dumps({
        "wape_model": round(forecast["wape_model"], 4),
        "wape_naive": round(forecast["wape_naive"], 4),
        "wape_improvement": round(forecast["wape_improvement_vs_best_baseline"] or 0, 4),
        "coverage": round(forecast["coverage_p10_p90"], 4),
        "shortfall_recall": None if shortfall["recall"] is None else round(shortfall["recall"], 4),
        "shortfall_precision": None if shortfall["precision"] is None else round(shortfall["precision"], 4),
        "cutoff": shortfall["cutoff"],
        "planner_gap": planner["calibration_gap"],
    }, indent=2))


if __name__ == "__main__":
    main()
