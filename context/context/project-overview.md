# Project Overview

**Sathi (সাথী)**: a Bangla-first financial copilot for mobile-wallet users, built for AI Hackathon 2026, Track 03 (Customer Innovation & Financial Independence), organized by DIU CPC x upay. It ships as a **live web app and an installable Android APK** built from one codebase.

Read this file first in every session. It is the product definition the agent resolves ambiguity against.

Status tags: **[FACT]** comes from the official hackathon documents. **[DECISION]** is a team choice. **[ASSUMPTION]** is an illustrative or synthetic value tracked in `docs/assumptions.md`. **[OPEN]** is tracked in `progress-tracker.md` §10.

Hackathon hygiene: this file defines the challenge-specific solution, so keep it **local and uncommitted until T+0** (rulebook 4.1, 9.3), then commit it as one of the first commits of the window.

---

## 1. Overview

Many mobile-wallet users have access to financial services but not financial control. Income arrives at one time and obligations at another, so users discover the gap only when they are already short, usually in the last week of the month. They then borrow informally, skip essentials or abandon savings goals. Frequent small cash-outs add fees and take money out of the digital record. A raw transaction list does not help, because it is not understandable.

Sathi turns a user's wallet transaction history into four things they can act on:

1. It **explains** their money in plain Bangla.
2. It **forecasts** the chance of running short before the next income, as a range and a probability.
3. It builds **savings plans** with honest probabilities and trade-offs.
4. It shows which repeated **cash-outs** could plausibly have been digital, with the fee impact.

Every number is computed by deterministic engines or ML models. The LLM only routes the question and narrates the result, and a validator blocks any number that did not come from those engines. Sathi informs and plans. It never moves money and never makes lending decisions.

The prototype runs entirely on **synthetic data**. It is designed so it could be validated later on governed upay data **[FACT: the guideline allows this as a possible follow-on, not a promise]**.

### Why AI adds value beyond a rule
A rule such as "save 20% of income" ignores that this user's income arrives late, that their spending is lumpy, and that the plan may fail. Sathi replaces it with a **calibrated probability** ("this plan has about a 62% chance of working given your history, here is a plan with about 85%"). That comes from a quantile forecast of cash flow plus Monte Carlo simulation, which a fixed rule cannot produce. The guideline's product-readiness test asks exactly this question **[FACT]**.

### Problem statement (official template)
> For low- and irregular-income wallet users (for example garment workers, gig riders, remittance-receiving households), unpredictable cash flow and habitual cash-outs cause month-end shortfalls and fee leakage. We will build **Sathi**, which uses transaction history to forecast liquidity pressure, build realistic savings plans, and flag avoidable cash-outs, with success measured by shortfall early-warning recall and precision, goal-plan calibration, and simulated cash-out reduction.

### The track's big question **[FACT]**
> How might an MFS platform help customers become more financially confident and independent, not merely more active users?

Sathi's answer: **give the customer foresight and honest options, and leave the decision with them.**

---

## 2. Users

### Primary user
**Rina** **[ASSUMPTION: synthetic hero persona]**: a garment worker with a fixed monthly salary that arrives around the 7th. Rent, bills and family transfers cluster right after payday, and her balance runs thin in the last week. She uses the wallet daily and withdraws cash often by habit. She reads Bangla comfortably and may prefer speaking to typing.

### Personas (5, used for demo variety, the offline bundle, and per-persona fairness reporting)

| # | Persona | Defining pattern | Why included |
|---|---|---|---|
| 1 | Salaried garment worker (Rina, hero) | Fixed salary, front-loaded obligations, month-end squeeze | Core story |
| 2 | Remittance-receiving household | Irregular, lumpy inflows | Forecast under irregular income |
| 3 | Gig / ride-share driver | Daily variable income, many small flows | High-frequency volatility |
| 4 | Student | Small, sporadic inflows from family, little history | Low-data case, persona priors |
| 5 | Small shopkeeper | Mixed personal and business flows, cash-heavy | Cash dependency |

All personas are synthetic. Their parameters are ASSUMPTIONs documented in `docs/assumptions.md`. Volatility measures are normalized per user, so an irregular earner is not mislabeled as unhealthy for earning irregularly.

### Secondary audiences (not end users)
- upay product, business and technical reviewers: relevance, impact, path to production.
- Hackathon judges: the official evaluation framework **[FACT]**.

---

## 3. Goals

1. **Foresight.** Tell a user, at least 7 days ahead, the probability that their balance will fall below an essentials threshold before the next expected income. Show the forecast as a range, not a single line.
2. **Understanding.** Turn a raw transaction list into plain-Bangla categories and insights that a non-technical user can read in under a minute.
3. **Honest planning.** Convert a savings goal into up to three plan options, each with a monthly amount, a probability of success and a trade-off. Say plainly, and kindly, when the goal is unlikely in the requested time, and always offer a next option.
4. **Cash-out awareness.** Show where repeated cash-outs could plausibly have been digital and what the fees were, with the fee rate shown as a labeled assumption.
5. **Access.** Let the user ask in Bangla, by text or voice, and get answers grounded in their own data. The four official journeys also work from starter chips with no LLM.
6. **Trust.** Make every figure traceable. Each insight carries evidence and one of the labels Data, Prediction, Assumption, or Generated text.
7. **No manipulation.** No urgency language, upsell, guilt copy or hidden fees **[FACT: official Track 03 requirement]**.
8. **Honest evidence.** Report results against baselines, with calibration and per-persona fairness, and state clearly that they come from synthetic data.
9. **Production path.** Define data and API contracts and a pilot design so the prototype could connect to a real wallet backend.
10. **Installable and resilient.** The same app ships as an Android APK built by CI that installs on a real phone and degrades gracefully with no backend or internet.

---

## 4. Core User Flow

Hero journey for Rina:

1. **Open Sathi** (installed APK or live URL). The app pings the backend, and the user selects a synthetic demo user (prototype login). The app opens in Bangla.
2. **See the big number.** The Overview shows one headline figure, for example the chance of running short before payday, with a one-sentence Bangla explanation and a "why?" link.
3. **Understand the money.** Spending is grouped into simple categories (rent, food, family, bills, cash-out, other) with plain-language insights, for example which weeks have the largest outflows.
4. **Check the forecast.** The Forecast screen shows a median line with a p10 to p90 band, a marker for the expected income date, a marker for the lowest-balance point, and the probability in words and number.
5. **Ask why.** The user taps a starter chip or the assistant, by typing or speaking "প্রতি মাসের শেষে আমার টাকা কম পড়ে কেন?" The transcript appears and can be edited before sending. The answer explains the recurring pattern and names the heaviest-outflow weeks, using numbers from the engines.
6. **Set a goal.** "৬ মাসে ৩০,০০০ টাকা জমাতে চাই।" The app shows "আপনি কি ৳৩০,০০০ বোঝাতে চেয়েছেন?" and, once confirmed, up to three options side by side (longer timeline, trimming a named leakage, or a percentage of each inflow), each with a probability and a trade-off. If the requested plan is unlikely, it says so plainly and offers the next option.
7. **Reduce cash-outs.** "ক্যাশ-আউট কমাব কীভাবে?" shows repeated cash-out patterns, which could plausibly have been digital, and the fee impact, with the fee assumption visible.
8. **Check the evidence.** "কেন এই পরামর্শ?" shows the data window, the as-of date, model versions, assumptions and a label chip on each figure.
9. **Decide.** The user chooses. Sathi never acts on their behalf. Saving a chosen goal is an explicit user action that stores a record only. It does not move money.

**Failure paths that must also work:**
- The LLM provider is down, the spend cap or kill switch is on, or the validator rejects a draft: a deterministic template answer appears.
- The backend is asleep: a waking-up state appears, then the offline demo data after a timeout.
- The phone is offline: the offline demo mode appears with a persistent "Demo data, not live" label. Custom goals and free chat are disabled with a plain message.
- The device does not support Bangla speech, or permission is denied: typed input with a clear message.
- The user has little data: persona priors are used, confidence is shown as low, and the user is asked to confirm inputs.
- The goal is invalid or in the past: a plain error message.
- The user asks about loans, investments or moving money: a fixed, gentle refusal with a redirect.

### Mapping to the four official example experiences **[FACT]**

| User says | Sathi's response |
|---|---|
| "I need to save ৳30,000 in six months." | Goal planner: target plan, feasible monthly contributions, trade-offs |
| "Why do I always run short before month-end?" | Recurring cash-flow pattern and the weeks with the largest outflows |
| "How can I reduce cash-outs?" | Repetitive cash-out patterns with plausible digital alternatives |
| "I don't understand these transactions." | Simple categories and plain-language insights |

---

## 5. Features

### Understand
- **Rules-based categorizer with a reason trace** for every category (P0). A classifier is intentionally not built, because it would learn the rules that generated the synthetic labels.
- Metrics: savings rate, income volatility (normalized per user), buffer days, cash dependency ratio, fee leakage, fixed-commitment ratio.
- Plain-Bangla summary built from reviewed templates.
- "I don't understand these transactions" view: each transaction gets a simple category and a plain-language label.

### Predict
- Daily cash-flow forecast: p10, p50, p90 from LightGBM quantile regression on the residual after known income windows and recurring obligations.
- Balance paths from a seeded block bootstrap that keeps day-to-day correlation, giving `P(shortfall)` before the next expected income and the expected lowest-balance date. The essentials threshold is a configurable assumption.
- Naive and seasonal baselines for comparison.
- Low-data users fall back to persona priors with confidence `low`.

### Plan
- Goal planner: Monte Carlo over forecast uncertainty, up to three option types, each returning monthly amount, `P(goal met)` and trade-off.
- Goal types are data-driven (emergency fund, education, device, family need, travel). A new type is a config change.
- The planner never recommends a contribution that breaches the essentials safety buffer.
- Deterministic amount parsing ("৩০ হাজার", "ত্রিশ হাজার", "30k") with a confirmation line before any amount is used.

### Act
- Cash-out pattern detector: repeat counterparty, amount and cadence, plus a replaceability score based on whether a later payment went to a merchant that accepts digital (P1).
- Fee impact with a configurable fee rate, shown with the Assumption chip.

### Access
- Bangla-first interface with a language setting (`bn` default, `en` available).
- **Starter-question chips for the four official journeys** call the tools directly with templates and need no LLM (P0).
- Free-text assistant chat with tool-calling (P1).
- Voice input: Capacitor speech-recognition plugin (`bn-BD`) in the APK, Web Speech API on the web build. The transcript is shown and editable before sending, and never sent automatically. If voice is unavailable, typed input with a clear message (P1).

### Trust and transparency
- `evidence` block on every insight (data window, as-of date, model versions, config hash, assumptions, generated-text flag, validator result).
- "কেন এই পরামর্শ?" panel with exactly five label chips: **Data, Prediction, Assumption, Generated text, Demo data**.
- Numeric validator that fails closed to deterministic templates.
- **Offline demo mode** (P0): if the backend or internet is unavailable, the app switches to bundled, backend-produced demo data for all five personas, with a visible "Demo data, not live" label. It answers preset scenarios only and never fakes a live computation.
- A thin Responsible AI page linked to the model card (P1).

### Evaluation and responsible AI
- Forecast metrics: WAPE, pinball loss, p10 to p90 coverage, shortfall recall and precision at a 7-day lead, each against baselines, on user-level and time-level splits.
- Planner back-test: stated `P(goal met)` against how often goals were met on held-out history.
- Per-persona and per-income-band results, noise-robustness test, error analysis.
- Prompt-injection test set, Bangla prompt test set, access-scoping tests, copy-lint test for banned words.
- Detector results against injected patterns are labeled **sanity checks**, not accuracy claims.

---

## 6. Scope

### In scope
- Synthetic dataset generator: five personas, seeded and reproducible, documented injected patterns, user and time splits, frozen test set.
- Metrics engine, rules categorizer, quantile forecaster, path simulation and shortfall estimator, goal planner, cash-out detector.
- FastAPI backend with typed schemas, token auth for synthetic users, `/v1/me/...` scoping from the token, consistent error schema, rate limits.
- LLM layer: sanitizer, tool-calling orchestrator, provider adapter, Bangla templates, numeric validator, deterministic fallback, kill switch and spend cap.
- Next.js static-export frontend: Overview, Forecast, Goal Planner, Cash-out Insights, Chat and voice, evidence panel, debug screen.
- **Capacitor Android wrapper and a GitHub Actions workflow that builds a debug-signed APK on every push to `main`.**
- **APK published as a public GitHub Release asset on `v*` tags, plus a live web URL from the same codebase.**
- **Offline demo mode with bundled precomputed data for all 5 personas, clearly labeled "Demo data".**
- Live deployment (frontend and backend), CI, tests, README with all ten rulebook items, model card, evaluation report, risks and assumptions registers, `docs/third_party.md`.
- Demo video (3 to 5 minutes) and project report **[FACT: both required by the rulebook]**.
- Documented data contract, API contract and post-hackathon validation plan.
- On-site update work after pre-evaluation, added later as units numbered from 31.

### Out of scope (not built, do not suggest dependencies for these)
- Any real upay integration, real customer data or real PII.
- Moving money, initiating payments, cash-out requests or any state-changing financial action.
- Lending, credit approval or denial, loan offers, interest-rate quotes. Credit readiness is P2 and informational only.
- Investment advice, product recommendations, upsell, cross-sell or offer cards.
- Real user registration, passwords, OTP flows, KYC or production-grade authentication.
- Push notifications, SMS or WhatsApp delivery, scheduled reminders.
- Native-only code (Kotlin or Swift), Play Store or App Store publishing, release keystores, and iOS builds. The Android APK is a Capacitor wrapper around the same web code, and plugin-level native code is allowed.
- Gamification: streaks, badges, leaderboards, confetti, countdowns.
- Fine-tuning or training an LLM. Pretrained models through an API only.
- A trained transaction classifier (the categorizer is rules with reason traces).
- Real-time streaming of transactions, background job queues, microservices, Postgres.
- Multi-currency, multi-wallet or multi-account aggregation, open-banking connectors.
- A full analyst or admin console. An aggregate evaluation report is enough.
- Anomaly detection, credit-readiness signals and a financial health score view (all P2, only if time remains).
- Live computation in offline mode (offline serves precomputed scenarios only).
- Reproducing any visual assets, logos, name or copy from another product.

---

## 7. Priorities **[DECISION]**

Hour gates are measured from T+0. **`progress-tracker.md` §4 is authoritative.** If they differ, the tracker wins.

| Tier | Contents | Gate |
|---|---|---|
| **P0 (must ship)** | APK pipeline, offline demo mode, dataset and splits, metrics, rules categorizer, forecast and shortfall probability, goal planner, API with evidence, LLM layer with validator and fallback, **starter chips for the 4 official journeys**, Overview / Forecast / Goal Planner screens, "explain my transactions" view, model card and evaluation report, README, deployment, video, project report | Done by **T+50** |
| **P1 (ships if P0 is done)** | Free-text chat, voice, cash-out detector and screen, motion and haptics polish, thin Responsible AI page | Done by **T+58** |
| **P2 (cut without discussion)** | Anomaly detector, credit-readiness signals, financial health score view, extra languages | **Cut at T+56** if unfinished |

**Feature freeze at T+62** (bug fixes, README, report and video only). **Submit at T+66.** Never submit in the last two hours. The unit order is in `progress-tracker.md` §9.

---

## 8. Success Criteria

"Done" must be verifiable. Targets are labeled **simulated**: they are measured on synthetic data and are not claims about real upay customers.

### Product and prototype
- [ ] A person with no briefing can complete all four official journeys in Bangla on the live URL, unaided, using starter chips or free text.
- [ ] Overview, Forecast and Goal Planner each show loading, waking-up, offline, empty, error and success states.
- [ ] The demo scenario set includes both a case where a requested goal is **unlikely** (shown plainly with at least two alternatives and probabilities) and a case where a plan is **feasible**. The hero persona's parameters are tuned so the ৳30,000 in 6 months scenario is meaningful **[ASSUMPTION: depends on synthetic surplus]**.
- [ ] The app works end to end with the LLM provider disabled (template answers).
- [ ] Voice input in `bn-BD` works on the demo phone, or the typed fallback appears with a clear message.
- [ ] The live URL passes a smoke test of the four journeys before submission, and `/healthz` shows the expected commit.

### Android APK
- [ ] GitHub Actions produces an installable debug APK on every push to `main`.
- [ ] A `v*` tag publishes the APK as a **public GitHub Release** asset, and the submission links the Release.
- [ ] The APK is installed and tested on at least one real Android phone, and all 5 personas work.
- [ ] With airplane mode on, the app opens, shows demo data with the label, and nothing crashes. A cold-started free-tier backend ends in the demo bundle, not a blank screen.
- [ ] The Android back button closes sheets first, goes back second, and exits only from the root tab.
- [ ] No API key or secret is present in the APK, the web bundle or the repo (the build bakes in only `NEXT_PUBLIC_API_URL`).

### Forecast and planning quality (simulated, frozen test set)
- [ ] Forecast WAPE improves on the best naive baseline. **Target: at least 20% improvement**, reported with the exact figure. If not met, the gap is documented honestly.
- [ ] p10 to p90 coverage is within an agreed tolerance of the nominal 80%, reported with the exact figure.
- [ ] Shortfall early-warning recall at a 7-day lead reaches the target (hypothesis: at least 80%), **reported together with precision**, with the alert cutoff chosen on the validation set only.
- [ ] Planner property tests pass: more time never lowers `P(goal met)`, and a higher contribution never lowers it.
- [ ] Planner back-test: stated `P(goal met)` is compared with observed outcomes on held-out history, and the calibration gap is reported.
- [ ] Cash-out detector results against injected ground truth are reported as **sanity checks**.
- [ ] Results are reported per persona and per income band, plus a noise-robustness curve.

### Trust and safety
- [ ] 100% of numbers in validated LLM answers match tool outputs. The numeric-consistency suite passes, including Bengali digits, `৳` and comma formatting.
- [ ] The prompt-injection test set fails to extract another user's data or alter figures.
- [ ] A token for user A cannot read user B's data (tests prove it), and no route accepts a user id.
- [ ] Out-of-scope requests (loans, investments, moving money) return the fixed refusal.
- [ ] Every response with insight carries an `evidence` block and a `display` string for each figure.
- [ ] The copy-lint test passes, and a native-speaker review of all UI and template copy finds no urgency, upsell, guilt or hidden-fee language.
- [ ] No secrets or real PII in the repository, and a grep of the built `web/out` finds no key prefixes.

### Hackathon requirements **[FACT]**
- [ ] Public GitHub repository with a continuous commit history from both phases, from every member, with no squash-merges.
- [ ] No challenge-specific code existed before T+0.
- [ ] `README.md` contains all ten required items (including the live URL), and a stranger can run the project from it.
- [ ] Video and project report submitted at the T+66 target, and at least 2 hours before the deadline.
- [ ] Every team member can explain the design, implementation and AI components.
- [ ] Significant external components, including AI coding tools, are disclosed in `docs/third_party.md`.

---

## 9. Impact Hypotheses (for validation, not claims)

| Hypothesis | How to test with real governed data later |
|---|---|
| Users who receive early shortfall warnings have fewer shortfall incidents | A/B pilot comparing shortfall events and informal-borrowing proxies |
| Users with probability-based goal plans complete more goals | Goal completion rate, treatment vs control |
| Showing cash-out patterns and fees reduces avoidable cash-outs | Cash-out frequency and fees paid at 30, 60 and 90 days |
| Planning tools improve retained balance and retention | Average balance and activity retention |
| Users feel more confident | Short in-app survey on financial confidence |

**Guardrail metric for any pilot:** no increase in unnecessary spending. Sathi is measured on customer outcomes (buffer days, shortfall incidents, goal completion, fees avoided), not on transaction volume.

**Revenue tension, stated openly:** fewer cash-outs may reduce cash-out fee income. Possible offsets are more digital merchant payments, retained balance, lower churn and trust. These are hypotheses to test. Sathi's recommendations are fee-transparent and never driven by upay's revenue **[ASSUMPTION: no upay tariff or revenue data has been provided, see Q8]**.

---

## 10. Constraints

- **Time:** 72 hours of initial development from T+0, then an on-site update phase and a final 90-minute evaluation **[FACT]**. T+0 is not yet confirmed **[OPEN: Q1]**.
- **Team:** 1 to 3 registered members, no substitutions **[FACT]**.
- **Integrity:** no substantially complete challenge-specific solution before T+0, a continuous commit history, and disclosure of external components **[FACT]**.
- **Data:** synthetic, public or self-generated only **[FACT]**.
- **Responsible AI minimums:** privacy, explainability, fairness check, security, human oversight, transparency, no harmful automation **[FACT]**.
- **Architecture rule:** sensitive decision logic does not live inside a free-form LLM prompt **[FACT]**.
- **Android:** `minSdk 24`, HTTPS only, debug-signed APK, minimum permissions (`INTERNET`, `RECORD_AUDIO`), keys exist only on the backend, free-tier cold starts are expected so the UI shows a waking-up state and then the demo bundle.
- **Time reference:** "today" in the prototype is `dataset.as_of_date`, the last day of the synthetic window, never the real date.

---

## 11. Product Principles

1. **Calm over busy.** One primary action and one headline number per screen.
2. **Plain language first.** Every chart and metric has a one-sentence Bangla explanation.
3. **Ranges, not false precision.** Forecasts show a band and a probability.
4. **Honest trade-offs.** Plans show options and their costs. "Not that fast" is a valid answer, and it always comes with a next option.
5. **Evidence is one tap away.** Every figure can be traced.
6. **The customer decides.** Sathi informs and plans. It never acts or pressures.
7. **Bangla-first, not Bangla-translated.** Layout and copy are tested in Bangla, with a native-speaker review.
8. **Style reference:** a calm personal-finance feel in the spirit of modern apps like Origin, as inspiration only. The visual language is iOS-style (hairline cards, bottom tabs, segmented control, glass on floating chrome only) with Android behavior (back button, system font scaling, local Bangla font). The theme (dark-first or light-only) is decided in `progress-tracker.md` Q20, and exact tokens live in `ui-context.md`. No copied name, assets or copy.

---

## 12. Glossary

- **MFS:** Mobile Financial Services.
- **Cash-out:** converting wallet balance into physical cash through an agent.
- **Shortfall:** the balance falling below the essentials threshold before the next expected income.
- **Essentials threshold:** the minimum daily amount needed for essentials (configurable ASSUMPTION).
- **Buffer days:** liquid balance divided by average daily essential spending.
- **p10 / p50 / p90:** the 10th, 50th and 90th percentile forecast values.
- **WAPE:** weighted absolute percentage error, the forecast accuracy measure.
- **Calibration:** how closely stated probabilities match observed frequencies.
- **Evidence block:** structured metadata attached to every insight (data window, as-of date, model versions, assumptions, labels).
- **Label chips:** Data, Prediction, Assumption, Generated text, and Demo data (shown by the client when the bundle is in use).
- **Validator:** a deterministic check that every number in an LLM answer exists in the tool outputs.
- **Starter chips:** one-tap questions for the four official journeys that call the tools directly, with no LLM.
- **Offline demo mode:** the app serves bundled, backend-produced demo data when the backend is unreachable.
- **`as_of_date`:** the config value that acts as "today", the last day of the synthetic window.
- **Capacitor:** the wrapper that packages the static web build as an Android app.
- **T+0:** the moment the organizers publish the problem requirements.
- **Paisa:** the integer unit in which all money is stored (100 paisa = ৳1).

---

## 13. Mapping to the Official Evaluation Framework **[FACT: guideline §15]**

| Criterion (weight) | How Sathi answers it |
|---|---|
| Problem relevance (20%) | A recurring, economically meaningful cash-flow problem for low and irregular income wallet users, mapped to all four official example experiences |
| AI/ML depth (20%) | Quantile forecasting on a structured residual, correlated path simulation, Monte Carlo goal planning with back-tested calibration, tool-calling LLM with a numeric validator |
| Business and customer impact (20%) | Simulated shortfall early-warning recall and precision, goal-plan calibration, fees avoided. A stated revenue tension and a pilot design with a guardrail metric |
| Prototype quality (15%) | A working APK on a real phone plus a live URL, all four journeys, resilient to a sleeping backend, an LLM outage and no internet |
| Innovation (10%) | Calibrated probabilities instead of fixed savings rules, honest "unlikely" answers with alternatives, a fail-closed validator, and a Bangla voice path with amount confirmation |
| Scalability and integration (10%) | Typed API and data contracts, config-driven personas, fees and goal types, a repository layer that swaps to a real backend, a pilot and governance plan |
| Responsible AI and security (5%) | Evidence and labels on every figure, per-persona fairness reporting, no autonomous financial action, injection and scoping tests, a spend cap and kill switch, no secrets in the APK |

Visual polish has no weight of its own. It only helps through prototype quality and innovation, so it never displaces P0 AI work.