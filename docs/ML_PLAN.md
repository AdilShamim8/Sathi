# Sathi ML Plan (ML owner: Rafi)

Repo state read on 2 Oct 2026, 22:10 (commit d98486c). Synthetic data only; every metric is labelled SIMULATED.

---

## 0. Where the ML stands now (audit of the code, not the README)

| Area | What the repo has | Verdict |
|---|---|---|
| Data | `data_gen/generate.py`, 600 users, 270,109 txns, 12 months (2025-10-01 → 2026-09-30), seed 20261003 | OK base, too small for per-persona eval; needs realism fixes (§3) |
| Forecaster | `ml/train.py`: 3 pooled LightGBM models (p10/p50/p90), target = daily net − trailing 30-day mean | Right family, wrong target design (§4.2) |
| **Leakage** | `ml/train.py::_income_dom(personas, persona)` reads the salary day **from persona config** and feeds it as a feature | **Leak.** The eval report claims "zero data leakage". Must use `core/recurring.py` output instead |
| Real metrics (`docs/metrics/eval.json`) | WAPE 0.976 vs naive 1.107; gig driver and shopkeeper **worse than naive**; p10–p90 coverage 92.2% (nominal 80% → over-wide, not calibrated) | Honest but weak |
| Shortfall eval | recall 0.907 / precision 0.938 overall, but shopkeeper recall **0.0**, gig driver **null** (no positives) | The headline comes from easy personas only |
| Planner back-test | All 105 users in one bucket (stated 2.8%, realised 0.9%) | Not a calibration test; needs goals across the feasibility range |
| **`ml/benchmark.py`** | Brier 0.082 vs 0.124, pinball 24.8 vs 41.2, baseline P/R 68.4/61.2, "SHAP" importances are **hard-coded constants** in `DEFAULT_BENCHMARK`, then written to `benchmark.json` and `eval_report.md` | **Fabricated results. Delete today.** Rulebook §9.1: falsely presented work → disqualification. A judge who opens one file ends your project |
| Safe-to-spend | Deterministic formula (balance + cash − commitments − buffer) | Fine as rule; make it model-based (§4.4) |
| Cash-on-hand | Linear 7-day decay of cash-outs | Fine v1; learn the decay rate per user (§4.3) |

**Rule for everything below:** every number in any doc is produced by a script in `ml/` from the frozen test split, and the doc shows the command that produced it.

---

## 1. The ML problem, stated precisely

Track 03 asks "why do I run short before month-end?" and "can I save ৳30,000 in 6 months?". Both reduce to one learning problem:

> **Given a user's wallet history up to day t, predict the distribution of their liquidity path over the next H days (H = until next income + 7, max 45).**

Everything user-facing is a functional of that path distribution:

| Output | Functional of the simulated paths |
|---|---|
| P(shortfall) | share of paths where liquidity < floor before next income |
| Trough date / size | argmin / min of each path → distribution |
| Safe-to-spend | Q_α(min liquidity) − floor (α = 0.10) |
| Action effect | ΔP(shortfall) when a candidate action modifies the paths (same random numbers) |
| P(goal met) | monthly roll-up of paths over the goal horizon |

So you build **one** probabilistic forecaster well, and the four features fall out of it. That is the AI-depth story for judges: one calibrated model, many decisions.

**Beginner grounding.** A normal regression model predicts one number (the mean). A *quantile* model predicts "the value that will be beaten only 10% of the time" (p10), the median (p50), and so on. Trained on the *pinball loss*, which punishes under-prediction and over-prediction asymmetrically. Stack 9–19 quantiles and you have an approximate full distribution per day. A *path* adds the time dimension: bad days tend to cluster, so you cannot sample each day independently (that makes month-end risk look too small).

---

## 2. Why this model family (evidence)

| Choice | Evidence | Alternative rejected |
|---|---|---|
| Gradient-boosted trees (LightGBM) for tabular, many-series, calendar-driven forecasting | M5 forecasting competition (Walmart, 42k series): LightGBM-based global models dominated the top places (Makridakis et al., IJF 2022) | Per-user ARIMA/Prophet: 600 tiny noisy series, no cross-learning, slow |
| One **global** model pooled across users | Same M5 finding: global models beat local ones when series are short | Per-persona models: too little data, worse fairness |
| Quantile loss + conformal calibration | Conformalized Quantile Regression gives finite-sample coverage guarantees on top of any quantile model (Romano et al., NeurIPS 2019) | Raw quantile output: your 92% vs 80% shows it is miscalibrated |
| Block bootstrap for paths | Moving-block bootstrap preserves serial dependence (Künsch, Ann. Stat. 1989) | Independent daily draws (understate cumulative risk) |
| Brier score + reliability for P(shortfall) | Strictly proper scoring rules (Gneiting & Raftery, JASA 2007) | Accuracy / F1 only: blind to calibration |
| Transformers / LSTMs / TFT | Not used. 600 users × 365 days is small; trees train in seconds on CPU and every teammate can explain them (rulebook §4.5) | DeepAR/TFT: slower, harder to explain, no gain at this scale |

Prior work on the same problem: IBM Research forecast bank balances and extracted recurring transactions for low-wage workers (Zhang et al., 2018). ML alerts that a user will overdraw within a week cut overdraft fees 5–9% on 39,607 Mint users, with weak response among low-income users unless the message was simplified (Ben-David et al.). This supports the "one number + one action" UI.

---

## 3. Data

### 3.1 Synthetic generator: changes (data_gen/)

| Change | Why | Effort |
|---|---|---|
| Users 600 → **2,000** (400/persona) | Per-persona test sets currently 152–304 rows; shopkeeper/gig have no positive shortfalls | 5 min (config) |
| Two pockets: `wallet_balance` and hidden `cash_on_hand` ground truth | Lets you evaluate the cash-on-hand estimator against truth | 2 h |
| Rina: gross ৳13,550 (basic ৳7,400) + overtime N(2,600, 900) + 2 Eid bonuses ≤ basic + 10% late-wage months + rent paid in cash | Realism from the RMG wage gazette and Labour Rules; creates real variance | 1 h |
| Shocks: Poisson(0.25/month) × lognormal(mean ৳1,600) | Month-end squeeze must come from volatility, not only timing | 30 min |
| Tune so **every persona has 15–35% shortfall cycles** | Gig/shopkeeper currently have none → recall undefined | 1 h (iterate) |
| Behavioural response: discretionary spend shrinks when balance is low | Real people adapt; without it the model learns a fake world | 1 h |
| Drifted test cohort: 100 users/persona with shifted parameters (wage day 10–12, OT sd ×2, shocks ×2) never trained on | Answers "you just learned your generator" | 30 min |
| Remove the injected pattern "cash-outs followed by digital-capable merchant payments" | Cash spending is invisible in real wallet data | 10 min |

Transaction-mix realism reference (not training data): **PaySim**, a mobile-money simulator calibrated on real African mobile-money logs, with CASH_IN / CASH_OUT / PAYMENT / TRANSFER types (Lopez-Rojas et al., 2016; Kaggle). Use its type proportions and amount distributions as a sanity check for your generator, and cite it.

### 3.2 Splits (keep what exists, add two)

- User split 70 / 15 (validation + conformal calibration) / 15 (test, frozen). Keep the existing seeded split.
- **Time split inside each user:** forecast origins only in the last 90 days for val/test users.
- Drifted cohort = second test set.
- Berka = third, external test set (§3.3).

### 3.3 External real data: Berka (PKDD'99)

| Item | Detail |
|---|---|
| What | Real anonymised Czech bank data, 1993–98: 4,500 accounts, ~1.06M transactions with running balance; types include cash withdrawal (VYBER), household payment (SIPO), pension, loan payment |
| Access | CTU relational repository (public MariaDB, guest login) or Kaggle mirrors; download on your laptop |
| Use | Adapter → your data contract (`credit`→inflow, `VYBER`→cash_out, `SIPO`→bill_pay). Run the same pipeline: recurring detection, forecaster, shortfall labels (floor = 10% of median monthly inflow). Report the same metrics vs. the same baselines |
| Claim you may make | "The pipeline runs on real, noisy bank data and still beats the baselines." |
| Claim you may not make | "Validated for Bangladesh / upay customers." |
| Time box | 3 h, P1. Drop if P0 is late |

---

## 4. Models, component by component

### 4.1 Recurring-stream detector (`core/recurring.py`, exists) — P0
- Already detects 25–35-day intervals with ≤ 4-day variance. Extend to 7/14-day periods and output per stream: next expected date distribution (empirical jitter), amount median/IQR, confidence.
- **Replace `_income_dom` in `ml/train.py` with the detector's `days_to_next_income` computed only from history before the origin.** This removes the leak.
- Metric: precision/recall vs generator ground-truth streams (label it a sanity check).

### 4.2 Forecaster (`ml/`) — P0, the core

**Target redesign.** Currently one model predicts total daily net flow. Total net = salary spike + rent spike + noise; trees waste capacity on spikes the detector already knows. Split it:

```
daily_net(t) = Σ scheduled streams(t)   ← from recurring detector (dates + amounts, sampled)
             + discretionary_out(t)     ← LightGBM quantile model (this is the ML)
             + shocks(t)                ← user-level Poisson/lognormal fitted on history
```

**Discretionary model spec**

| Item | Value |
|---|---|
| Target | daily discretionary outflow (paisa ÷ user's trailing-90-day median, i.e. scale-free; multiply back after) |
| Quantiles | τ ∈ {0.05, 0.10, …, 0.95} (19 models) or 9 (0.1 steps) if time is short; sort predictions to remove crossing |
| Features (all computed with data < t) | days since last income, days to next detected income, day-of-week, festival window ±7 d, rolling 7/30-day discretionary mean/std, last 3 days' spend, cash-outs in last 7 d, estimated cash on hand, wallet balance ÷ median daily spend, persona-free volatility stats (CV of inflow), user lifetime days |
| Not allowed | persona label, config salary day, any ground-truth column, user_id |
| LightGBM | `objective="quantile"`, `alpha=τ`, num_leaves 31, learning_rate 0.05, n_estimators ≤ 2,000 with early stopping on validation pinball, min_child_samples 50, feature_fraction 0.8 |
| Training rows | ~2,000 users × ~300 days ≈ 600k rows; trains in minutes on CPU |

**Calibration (P0, 1 h).** Split-conformal on validation users: for each τ pair (p10, p90) compute the conformity score on the 35-day cumulative discretionary outflow and widen/narrow the band to hit 80% on calibration users. **Mondrian variant (P1):** do it per persona → per-group coverage guarantee = your fairness method.

### 4.3 Cash-on-hand estimator (`core/cash_on_hand.py`) — P0 upgrade
- v1 (exists): linear 7-day decay.
- v2: per-user decay rate fitted from the gap between consecutive cash-outs (if cash-outs come every ~5 days, cash lasts ~5 days). One parameter, closed form, explainable.
- Evaluate against generator ground truth: MAE of cash on hand, and shortfall metrics **with vs without** the estimator (ablation). This ablation is a strong slide.

### 4.4 Path simulator → shortfall, safe-to-spend, actions (`core/simulation.py`) — P0
1. For each of 1,000 paths: sample scheduled stream dates/amounts, sample discretionary days by inverse-CDF interpolation of the 19 quantiles using a **block-correlated uniform** (one draw per 7-day block, jittered daily), add shocks.
2. Liquidity path = wallet + cash-on-hand + cumulative net.
3. P(shortfall), trough distribution, **safe-to-spend = Q₀.₁₀(min liquidity) − floor** (replace the current deterministic formula, or show both and say which is ML).
4. Actions (P1): rerun with modified streams using the same random seed; rank by ΔP(shortfall).
- Unit test: on a toy random walk, P(shortfall after spending safe-to-spend) must equal α ± 0.01.

### 4.5 Goal planner (`core/planner.py`) — P0 fix of the back-test
- Monthly free-cash distribution = monthly sums of simulated paths (or block bootstrap of the user's monthly net), plus bonus months.
- Back-test properly: for each test user create goals at 5 difficulty levels (target = k × median monthly surplus × months, k ∈ {0.5, 0.8, 1.0, 1.3, 2.0}) so stated P(goal) spreads across 0–1. Then plot stated vs realised in 5 bins. Report the calibration error.

### 4.6 Cash-out replaceability (`core/cashout.py`) — P1
- Rule + small logistic regression on observable features: amount matches a recurring obligation (rent-sized, same day each month), user's past digital payments in that category, share of digital-accepting merchants in the agent's area, cash-out size vs typical. Label = generator ground truth "purpose payable digitally". Report precision/recall as a sanity check.

### 4.7 Unusual-spend flag — P2
- No new model: flag a day whose discretionary outflow exceeds the model's p95. Explain with the feature that moved most.

---

## 5. Evaluation protocol (what goes in eval_report.md)

All generated by `make eval` from the frozen test split, seed fixed, numbers copied by script.

| Table | Rows | Metrics |
|---|---|---|
| T1 Forecast | Model vs B1 seasonal-naive (same cycle-day last month), B2 30-day rolling mean, B3 **zero-discretionary rule** | pinball (avg over τ), WAPE of p50, CRPS of 35-day cumulative flow, 80% coverage before/after conformal |
| T2 Shortfall | Model vs **rule baseline** (liquidity ÷ avg daily spend < days to income) vs base rate | Brier, Brier skill score, PR-AUC, recall at precision ≥ 0.6, 7-day lead; reliability diagram (10 bins) |
| T3 Fairness | per persona, per income band, per gender (audit only) | recall gap, Brier, coverage (before/after Mondrian) |
| T4 Robustness | noise ×1/×2/×3, drifted cohort, Berka | same metrics as T1/T2 |
| T5 Ablation | − cash-on-hand, − recurring detector, − conformal, independent-day sampling | Brier, coverage |
| T6 Planner | 5 bins of stated P(goal) | stated vs realised, calibration error |
| T7 Explainability | SHAP (TreeExplainer) on the p50 discretionary model, computed, plus 3 per-user examples | mean abs SHAP |

Honest targets (synthetic): Brier skill > 0 vs rule; recall ≥ 0.8 at precision ≥ 0.6; coverage 80% ± 3 after conformal; pinball ≥ 15% better than best baseline. If a target is missed, report the miss and the reason. Judges trust a model that loses somewhere and says so.

**Beginner grounding on metrics.** Brier = mean of (predicted probability − outcome)², lower is better; *skill* = 1 − Brier_model / Brier_baseline, > 0 means better than the baseline. Reliability diagram: bucket predictions (0–10%, 10–20%…) and plot how often shortfall actually happened; a calibrated model sits on the diagonal. CRPS is the pinball loss integrated over all quantiles: one number for "how good is the whole distribution".

---

## 6. Build order (your hours, after T+0 per the team plan)

| Step | Task | Done when | Hours |
|---|---|---|---|
| 1 | **Delete `DEFAULT_BENCHMARK` and the hard-coded numbers in `eval_report.md`**; make `benchmark.json` written only by `ml/evaluate.py` | `grep -n "0.082\|24.8\|41.2" -r .` returns nothing | 0.5 |
| 2 | Run `ml/audit_data.py` (attached), paste output | Base rates per persona known | 0.25 |
| 3 | Generator fixes §3.1, regenerate 2,000 users | Every persona 15–35% shortfall cycles | 4 |
| 4 | Remove `_income_dom`; wire recurring detector features | Leak gone; retrained | 2 |
| 5 | Target split + discretionary quantile model + sorting | T1 vs B1–B3 | 4 |
| 6 | Conformal calibration | Coverage 80 ± 3 | 1 |
| 7 | Path simulator v2 + safe-to-spend from paths + toy test | T2 vs rule; unit test passes | 3 |
| 8 | Cash-on-hand v2 + ablation | T5 row | 1.5 |
| 9 | Planner back-test over 5 difficulty levels | T6 | 1.5 |
| 10 | `make eval` writes all tables + reliability PNG + SHAP | eval_report regenerated by script | 2 |
| 11 (P1) | Mondrian, actions, drifted cohort, Berka | T3, T4 | 6 |

P0 ≈ 20 h. Steps 1–2 are tonight.

---

## 7. What to say to judges (plain, factual)

- "One global LightGBM quantile model forecasts discretionary spending; recurring income and bills are detected from history; 1,000 simulated paths give the shortfall probability, the safe-to-spend amount and goal probabilities."
- "It beats a rule baseline on Brier skill; probabilities are calibrated with conformal prediction; coverage is checked per persona."
- "All results are simulated. The same pipeline also ran on a public real bank dataset (Berka). Real validation needs governed upay data."

---

## 8. LLM layer on OpenRouter (final decision)

### 8.1 What OpenRouter gives you (verified in its docs, Oct 2026)
| Feature | Fact | How Sathi uses it |
|---|---|---|
| API | OpenAI-compatible `/api/v1/chat/completions`, `tools`, `response_format: json_schema` (strict) on supporting models | One adapter `llm/providers/openrouter.py` (attached) |
| Model fallbacks | `models: [a, b, c]` tried in order on rate-limit, downtime, context or moderation errors; billed only for the model that answered; `model` field says which | Primary + 2 fallbacks; `model` goes into the evidence block |
| Privacy routing | `provider.data_collection: "deny"`, `provider.zdr: true`, `require_parameters: true` | Default `deny` + `require_parameters`; prompts carry only synthetic facts anyway |
| Logging | OpenRouter stores no prompts unless you opt in | Leave observability logging off |
| Free models | IDs ending `:free`; 20 req/min; **50 req/day** if < $10 credits bought, **1,000/day** with ≥ $10 | 50/day is not enough for a judged demo + tests. Buy $10 credit or use a cheap paid model. Many free endpoints only work with data collection allowed: another reason to stay off them |

### 8.2 Decision
- **Do not hard-code a model name from memory or a blog.** Model catalogs change weekly (the README still names `gemini-1.5-flash`, deprecated since Sept 2025). Choose by test with `pick_model.py` (attached): it pulls the live catalog, keeps tool-capable models under $2 per 1M output tokens, runs 12 fixed prompts (Bangla, Banglish, English, injection, loan request) through the real validator, and ranks by pass rate then latency.
- Set `LLM_MODELS=<top1>,<top2>,<top3>` from that table and record it in `docs/llm_selection.md` with the date. Read 3 Bangla answers per top model yourself; fluency is not auto-scored.
- Budget: ~200 calls/day × ~1.5k tokens ≈ well under $1/day on a cheap model. Set a monthly hard limit in the OpenRouter dashboard plus `LLM_DAILY_CAP` in the app.

### 8.3 Contract between ML and LLM (non-negotiable)
1. ML/core produce numbers → `core/formatting.py` makes display strings → passed as `facts = {"f1": "৳৪,২০০", ...}`.
2. LLM writes text with `{{f1}}` slots only. No digits, no number words (হাজার, লাখ, শতাংশ, percent...).
3. `validate()` rejects unknown slots, free digits, number words, over-long text → one retry → Bangla template.
4. Starter chips for the 4 official journeys call tools + templates directly; zero LLM dependence in the demo path.
5. LLM is used for: intent routing of free text, Banglish understanding, short narration. Never for numbers, thresholds, eligibility or advice.
6. Tests: the 12 picker prompts + your 60-prompt set run in CI with the provider mocked; one live smoke run before submission.

## 9. Cross-check log (what changed from the previous version of this plan)
| Item | Before | Now | Why |
|---|---|---|---|
| LLM provider | Gemini direct | OpenRouter with ordered fallbacks | Team decision; fallbacks remove the single-provider outage risk |
| Model choice | named model | measured by `pick_model.py` | Catalog churn; avoids another deprecated-model mistake |
| Free tier | assumed usable | 50 req/day cap without $10 credit | OpenRouter limits page |
| Validator | value matching | slot-filling + digit/number-word ban (code attached, self-test passes) | Binding errors and Bangla number words |
| Benchmark | hard-coded constants in repo | delete; only `ml/evaluate.py` writes numbers | Rulebook §9.1 |

## 10. Final strategy: fit to rulebook and repo (checked 2 Oct, 22:55, commit d98486c)

### 10.1 Rulebook gate (decide before any more ML commits)
| Rule | Repo fact | Required action |
|---|---|---|
| §4.1/§9.3: challenge-specific solution built inside the 72 h from T+0 | 35 commits on 2 Oct already contain data generator, forecaster, planner, API, LLM, web, APK. T+0 is still unconfirmed | Confirm T+0 with organizers now. If T+0 is later than today, this code was written before the window: disclose it and ask whether it is allowed. If not allowed, the honest path is a fresh repo at T+0 with work redone inside the window. Do not backdate, squash or hide commits |
| §9.1: no falsely presented work | `ml/benchmark.py` still hard-codes Brier/pinball/P-R/SHAP numbers | Delete before anything else |
| §4.4: disclose AI tools | Commit messages show AI-assisted generation | List Claude/AI coding tools in docs/third_party.md |
| §4.5: every member explains AI | Large generated codebase | Each owner walks through their module once before submission |
| §5.2: continuous history | OK so far | Keep small commits during the window |

### 10.2 Plan → repo file mapping (use existing files, no parallel structure)
| Plan item | Repo file | Change |
|---|---|---|
| Remove fake metrics | `ml/benchmark.py`, `docs/eval_report.md`, `docs/metrics/benchmark.json` | Delete constants; benchmark.json written only by `ml/evaluate.py` |
| Fix leak | `ml/train.py::_income_dom` | Replace with `core/recurring.py` days-to-next-income computed from history < t |
| Data audit | new `ml/audit_data.py` | As delivered |
| Generator realism, 2,000 users, cash pocket, drifted cohort | `data_gen/generate.py`, `config/personas.yaml`, `config/dataset.yaml` | Edit in place; regenerate `data/*.parquet` and demo bundle |
| Discretionary quantile model + conformal | `ml/features.py`, `ml/train.py`, `ml/inference.py` | Edit in place |
| Paths, shortfall, safe-to-spend from paths | `core/simulation.py`, `core/safe_to_spend.py` | Keep current formula as the rule baseline; add path-based version as the ML output |
| Cash-on-hand v2 | `core/cash_on_hand.py` | Per-user decay rate |
| Planner back-test | `ml/evaluate.py` | 5 difficulty levels |
| OpenRouter adapter | `llm/orchestrator.py` (currently no provider call) + new `llm/providers/openrouter.py` | Orchestrator calls `narrate()`; existing `llm/validator.py` + `llm/render.py` take the slot logic |
| Env vars | `.env.example`, README §9 | `OPENROUTER_API_KEY`, `LLM_MODELS`, `LLM_ENABLED`, `LLM_TIMEOUT_S`, `LLM_DAILY_CAP` |
| Model choice | new `llm/pick_model.py`, `docs/llm_selection.md` | Run once, record table |

### 10.3 Order of work (ML owner)
1. Delete fake metrics, push (15 min).
2. Run `ml/audit_data.py`, paste output (15 min).
3. Remove leak → retrain → regenerate eval.json honestly (2 h). This alone is a valid submission baseline.
4. Generator fixes + 2,000 users (4 h).
5. Discretionary model + conformal + paths + safe-to-spend from paths (8 h).
6. Evaluation tables T1–T7 generated by `make eval` (2 h).
7. OpenRouter wiring + model pick (2 h, can run in parallel by the LLM owner).
8. P1: Mondrian, actions, drifted cohort, Berka.

Stop rule: after each step the repo must still run the 4 official journeys; if a step breaks them, revert that step.

## Sources
- Makridakis, Spiliotis, Assimakopoulos, "M5 accuracy competition: Results, findings, and conclusions", *Int. J. Forecasting* (2022): https://doi.org/10.1016/j.ijforecast.2021.11.013
- Romano, Patterson, Candès, "Conformalized Quantile Regression", NeurIPS 2019: https://arxiv.org/abs/1905.03222
- Künsch, "The jackknife and the bootstrap for general stationary observations", *Annals of Statistics* (1989): https://doi.org/10.1214/aos/1176347265
- Gneiting & Raftery, "Strictly proper scoring rules, prediction, and estimation", *JASA* (2007): https://doi.org/10.1198/016214506000001437
- Zhang et al., "Financial Forecasting and Analysis for Low-Wage Workers" (IBM Research, 2018): https://arxiv.org/abs/1806.05362
- Ben-David, Mintz, Sade, "Using AI and Behavioral Finance to Cope With Limited Attention and Reduce Overdraft Fees" (FDIC): https://www.fdic.gov/system/files/2024-09/2020-ben-david.pdf
- Lopez-Rojas, Elmir, Axelsson, "PaySim: A financial mobile money simulator for fraud detection" (2016); dataset: https://www.kaggle.com/datasets/ealaxi/paysim1
- Berka / PKDD'99 Financial dataset (CTU): https://relational.fel.cvut.cz/dataset/Financial
- OpenRouter docs: rate limits https://openrouter.ai/docs/api-reference/limits · tool calling https://openrouter.ai/docs/features/tool-calling · structured outputs https://openrouter.ai/docs/features/structured-outputs · model fallbacks https://openrouter.ai/docs/guides/routing/model-fallbacks · provider selection https://openrouter.ai/docs/guides/routing/provider-selection · data collection https://openrouter.ai/docs/guides/privacy/data-collection
- RMG wage gazette (The Daily Star): https://www.thedailystar.net/business/news/govt-publishes-gazette-new-rmg-wage-3468181
