# CONTEXT.md: Project "Sathi (সাথী)" for AI Hackathon 2026, Track 03

> Historical master reference for the project: event rules, track brief, finance reasoning, product decisions, architecture, contracts, plan, risks and open questions.
> **Authority:** where this file conflicts with a file in `context/`, **the `context/` file wins** (`context/ai-workflow-rules.md` §4). If two `context/` files conflict, stop and flag it.
> **Status legend:** `[FACT]` comes from the official documents. `[DECISION]` is a choice we made. `[ASSUMPTION]` is a synthetic or illustrative value that must be validated. `[OPEN]` is an unanswered question.
> **Pre-T+0 hygiene:** this file contains challenge-specific content (persona, plan, wedge). Keep it **local and uncommitted** until T+0 is confirmed, then commit it with the other context files as the first commits of the window.

---

## 0. How to use this file (for humans and AI assistants)

- Treat this file as project memory. If a request conflicts with it, flag the conflict instead of silently deviating.
- Role of the assistant: senior mentor / forward-deployed engineer and judge-in-advance. Decide with reasons, challenge weak assumptions, think like a senior engineer.
- Never invent numbers about upay (fees, volumes, user counts). Anything not in the official documents is an `[ASSUMPTION]`.
- Hard rule: money logic never lives only in an LLM prompt (see §9).
- Update §19 (Decision log) and §20 (Open questions) whenever something changes. Update `context/progress-tracker.md` after every meaningful change.
- **Document hierarchy:**
  1. Official rulebook and guideline (`[FACT]` sections of this file are a summary only; the PDFs are the source)
  2. `context/ai-workflow-rules.md`, `context/architecture.md` §14 invariants
  3. Other `context/*.md` files (`project-overview`, `ui-context`, `code-standards`, `progress-tracker`, `specs/NN-*.md`)
  4. This file
  5. The T+0 brief **overrides the earlier track guideline** if they differ. Stop, flag, and update the context files before coding.

### Revision 2 summary (what changed from v1)
- The deliverable is now an **installable Android APK** (Capacitor, built by GitHub Actions, published as a public GitHub Release) plus a live web URL. See §14.
- Frontend is **Next.js static export** (no server features), not a server-rendered app.
- Theme is **dark-first** (Origin is a visual reference only; Sathi is the brand).
- Voice moves to **P1 with a typed fallback**; the browser Web Speech API is unreliable inside an Android WebView.
- Scope tiers and the work plan are re-timed to match the tracker (P2 cut at hour 56, feature freeze about hour 62, submit with at least 2 hours of buffer) and now build a **walking skeleton first**.
- Added: money as integer paisa, `display` strings, the evidence label scheme, offline demo bundle, rate limit and spend cap, fixed section cross-references.

---

## 1. Event overview `[FACT]`

| Item | Detail |
|---|---|
| Event | AI Hackathon 2026, part of AI DEV FEST 2026 |
| Organizers | DIU Computer and Programming Club (DIU-CPC), Dept. of CSE, Daffodil International University, together with **upay** |
| Audience | DIU students |
| Team size | 1 to 3 members, all officially registered, no substitutions |
| Devices | Each participant brings their own |
| Initial development | Exactly **72 hours** from T+0 (publication of problem requirements) |
| On-site final | **7 October 2026**, Daffodil International University |
| Exact release, submission and on-site times | `[OPEN]` To be announced separately by the organizers |

### Official challenge statement
> "Do not build AI for the sake of AI. Start with a real user or business problem, then use AI where it creates a defensible advantage. Identify a meaningful problem in digital financial services, design a useful product, and build a working prototype that could become relevant to the future of upay."

### What the organizers do NOT want
A generic chatbot, a dashboard, or a model-accuracy score. They want ideas that improve trust, customer value, financial independence, ecosystem performance, growth or operational efficiency in a modern MFS (mobile financial service).

### Program principles `[FACT]`
- Customer-first: a clear benefit for a customer, merchant, agent or internal user
- AI with purpose: AI does a meaningful prediction, recommendation, detection, optimization, generation or automation task
- Build, don't only pitch: a functional prototype is expected
- Privacy by design: no production customer data is provided or required
- Future-ready: explain how the idea could be validated with controlled upay data after the competition
- Responsible innovation: high-impact decisions stay explainable, secure and subject to human oversight

---

## 2. Competition rules and schedule `[FACT]`

### 2.1 Flow
1. **T+0:** problem requirements published
2. **T+0 to T+72h:** ideate, build, test, prepare the submission
3. **By T+72h:** submit video demo + project report + public GitHub link + required project materials (code pushed to GitHub within the window)
4. **First evaluation (pre-evaluation):** judges review the submission, video, report and materials; it counts toward the final result
5. **Final day (7 Oct 2026):** teams receive **new requirements or updates based on pre-evaluation** and implement them within an allotted on-site time
6. **Second evaluation:** the final **90 minutes** are reserved. Teams demo the updated project, explain the new work and answer questions
7. **Winners:** based on marks from **both** evaluations. Detailed weighting `[OPEN]`

### 2.2 Development rules
- Ideas and challenge-specific solutions must be generated and built **inside the 72-hour window** (§4.1)
- AI models, APIs, pretrained models, frameworks, open-source libraries and public datasets are allowed unless the brief restricts them
- Pre-existing **general-purpose** components are allowed. A **substantially completed, challenge-specific solution prepared in advance is NOT allowed** (§4.3, §9.3)
- Disclose significant external datasets, APIs, services and pre-existing components if asked (we disclose proactively in `docs/third_party.md`, including AI coding tools)
- Every member must understand and be able to explain the design, implementation and AI components during judging

### 2.3 GitHub rules
- Public GitHub repository
- **Clear and continuous commit history** in both the initial phase and the on-site phase. A single final upload does not satisfy this
- Bug fixes, features and improvements committed step by step
- Initial code pushed by the initial deadline. Final-day updates pushed inside the on-site window
- Our stricter team policy: no squash-merge, no force-push to `main`, every member commits

### 2.4 Mandatory README.md (all 10 items)
| # | Item | Required content |
|---|---|---|
| 1 | Project overview | Problem, solution, purpose |
| 2 | Features | Implemented features and how AI is used |
| 3 | Technology stack | Languages, frameworks, models, APIs, libraries, services |
| 4 | Requirements | Software, dependencies, hardware, prerequisites |
| 5 | Installation and setup | Step-by-step |
| 6 | Environment variables | Names, purpose, how to configure. **Placeholders only, never secrets** |
| 7 | Run and build commands | Exact commands |
| 8 | **Live deployment URL** | Link judges can open |
| 9 | Testing instructions | How to run tests or verify features |
| 10 | Other configuration | Extra files, settings, access requirements |

Judges must be able to understand, set up, run and test the project from the README alone. Our README also carries the APK Release link and the "Install anyway" note for Play Protect.

### 2.5 Submission requirements
- **Video demo:** how the idea works, the features and AI components implemented, and the real-life impact or value
- **Project report:** problem, idea, implemented solution, key features, AI approach, intended real-life impact
- Public repo link and required project materials. The submission channel and formats will be announced `[OPEN]`

### 2.6 Integrity
- Copied or falsely presented work leads to **disqualification**
- External resources must not be misrepresented as original work
- No pre-built challenge-specific solution
- Registration and substitution rules apply to all members

---

## 3. Official evaluation framework `[FACT]`

| Criterion | Weight | What good looks like |
|---|---|---|
| Problem relevance | 20% | Solves a real, meaningful customer/business problem |
| AI/ML depth | 20% | AI is material and technically credible |
| Business/customer impact | 20% | Clear, measurable value and plausible economics |
| Prototype quality | 15% | Working end-to-end experience, not only slides |
| Innovation | 10% | Distinctive insight or differentiated product idea |
| Scalability and integration | 10% | Believable path to real systems and future data |
| Responsible AI and security | 5% | Privacy, explainability, fairness, safety considered |

Notes:
- Responsible AI is only 5% as a criterion, but Track 03 has an explicit "IMPORTANT" empowerment clause, and the minimum expectations in §4 are treated as pass/fail in spirit.
- Visual polish has no weight of its own. It only helps through "prototype quality" and "innovation".

---

## 4. Responsible AI and safety minimums `[FACT]`

| Principle | Minimum expectation |
|---|---|
| Privacy | Only synthetic, public or self-generated data during the hackathon |
| Explainability | Show the main reasons behind important predictions |
| Fairness | Check whether the model behaves differently across relevant groups |
| Security | Consider adversarial manipulation, prompt injection, data leakage, access control |
| Human oversight | High-impact actions allow appropriate human review |
| Transparency | Clearly separate predictions, assumptions and generated explanations |
| No harmful automation | Do not autonomously approve or deny consequential financial decisions without controls |

---

## 5. Official track list (for context) `[FACT]`

| # | Track | Theme |
|---|---|---|
| 01 | Trust & Risk Intelligence | Fraud, scam, account takeover, mule networks, agent risk |
| 02 | Customer Intelligence | Customer 360, churn, segmentation, next-best-action |
| **03** | **Customer Innovation & Financial Independence** | **Financial health, savings goals, spending intelligence, coaching, inclusive UX (OUR TRACK)** |
| 04 | Growth & Campaign Intelligence | Next-best-offer, uplift, campaign optimization |
| 05 | Merchant & Agent Intelligence | Demand forecasting, agent liquidity, benchmarking |
| 06 | Operations & Service Intelligence | Dispute investigation, support copilot, complaint intelligence |
| 07 | Open Innovation | Any responsible AI solution for an MFS challenge |

Teams may pick a track or propose a closely related MFS problem.

---

## 6. Track 03 brief `[FACT]`

**Goal:** a flagship differentiation track. Move beyond "payments" and use AI to help people make better financial decisions, become more self-directed, and get more value from digital financial services.

**Big question:** *How might an MFS platform help customers become more financially confident and independent, not merely more active users?*

### Project opportunities (official list)
1. **AI Financial Health Coach:** explain spending behavior, cash dependency and habits in simple language
2. **Personal Savings Planner:** turn a goal into a realistic plan based on simulated cash-flow behavior
3. **Smart Spending Companion:** identify unusual or avoidable spending and suggest practical actions
4. **Cash-Flow Forecasting:** predict short-term inflows, outflows and liquidity pressure
5. **Financial Goal Copilot:** plan for education, emergency funds, travel, devices, family needs, etc.
6. **Inclusive Financial Assistant:** voice, Bangla-friendly language, simplified UX
7. **Financial Literacy Personalizer:** adapt education to demonstrated behavior, not generic content
8. **Responsible Credit Readiness:** explainable signals about how consistent behavior may affect future eligibility, **without making autonomous lending decisions**

### Example experiences (official)
| User says | AI could respond |
|---|---|
| "I need to save ৳30,000 in six months." | Build a target plan, identify feasible monthly contributions, show trade-offs |
| "Why do I always run short before month-end?" | Explain the recurring cash-flow pattern and identify the weeks with the largest outflows |
| "How can I reduce cash-outs?" | Identify where digital alternatives could plausibly replace repetitive cash withdrawals |
| "I don't understand these transactions." | Translate the transaction pattern into simple categories and plain-language insights |

### IMPORTANT (official)
Projects in this track must **empower the customer**. Avoid manipulative recommendations, hidden fees, or designs that encourage unnecessary spending. The objective is **informed choice and sustainable financial behavior**.

---

## 7. Official idea-development framework and data strategy `[FACT]`

### 7.1 One-page logic chain every team should complete
User → Problem → Why now → Solution → AI role → Impact → Data → Validation → Scale

### 7.2 Problem statement template
> For [specific user], [specific problem] causes [measurable consequence]. We will build [AI-powered product] that uses [data] to [decision/action], with success measured by [metric].

### 7.3 Data strategy
- No production upay data. Use synthetic data, public datasets or own simulations
- Make the data realistic enough to reproduce meaningful patterns, but **clearly synthetic**
- **Inject known patterns** (normal behavior, anomalies, seasonality, etc.) for testing
- **Document every synthetic assumption**
- Never use real PII to improve realism
- Keep a **clean test set** not used for training
- Post-hackathon: selected solutions *may* be considered for controlled validation on governed, anonymized or aggregated data (not a promise)

### 7.4 Reference architecture (suggested, not mandatory)
INPUT → INTELLIGENCE → ACTION: synthetic/public data → feature and context layer → ML/AI engine → explanation/recommendation → user action → measurable outcome → feedback loop.

Suggested layers: Data (Python/Pandas/Postgres), ML (scikit-learn/XGBoost/LightGBM/PyTorch), GenAI (LLM + RAG), API (FastAPI/Node), Frontend (React/Next.js), Monitoring.

**Architecture expectations:**
- Separate data preparation from model inference
- Keep business rules distinct from ML predictions
- Make model outputs traceable and explainable
- Design APIs so the prototype could connect to a real backend
- **Do not put sensitive decision logic entirely inside a free-form LLM prompt**

### 7.5 Product readiness checklist `[FACT]`
User problem is frequent or economically meaningful · AI adds value beyond a deterministic rule · clear action after the prediction · measurable business benefit · validatable with future real data · privacy/fairness/explainability/security addressed · integrable into a real workflow.

Post-hackathon pathway: Competition → Technical review → Business review → Controlled validation → POC → Pilot assessment → Next decision (integrate / incubate / partner / close).

---

## 8. Our product: Sathi (সাথী) `[DECISION]`

### 8.1 One-line pitch
**A Bangla-first financial copilot, installed as an Android app, that tells wallet users ahead of time when they will run short, builds savings plans with honest probabilities, and shows which cash-outs could be digital, with every number computed by auditable engines and never by the LLM.**

### 8.2 Problem statement (official template)
> For low- and irregular-income wallet users (e.g., garment workers, gig riders, remittance-receiving households), unpredictable cash flow and habitual cash-outs cause month-end shortfalls and fee leakage. We will build **Sathi**, which uses transaction history to forecast liquidity pressure, build realistic savings plans, and flag avoidable cash-outs, with success measured by shortfall early-warning recall, goal-hit probability, and simulated cash-out reduction.

### 8.3 Logic chain (filled in)
| Step | Answer |
|---|---|
| 1. User | Hero persona **Rina**, garment worker with a fixed monthly salary (see §10.7). Four other personas appear in the fairness analysis |
| 2. Problem | Income-expense timing mismatch → month-end shortfall financed expensively (informal borrowing, skipped essentials); habitual cash-outs add fees and erase the digital footprint; raw transaction lists are not understandable |
| 3. Why now | LLMs can narrate structured analytics in Bangla; quantile forecasting is cheap and fast; the target users are on Android phones, so an installable app reaches them directly |
| 4. Solution | Android app (Capacitor) and web: Overview (plain-language understanding), Forecast (shortfall risk), Goal Planner (3 options with probabilities), Cash-out Insights, Bangla chat with starter chips and voice, "Why this advice?" panel |
| 5. AI role | Prediction (quantile cash-flow forecast), classification (transaction categorizer), optimization/simulation (Monte Carlo planner), pattern detection (cash-out substitution), generation (grounded, validated Bangla narration) |
| 6. Impact | Early warning of shortfall, higher probability of reaching goals, reduced fee leakage, better understanding |
| 7. Data | Fully synthetic, seeded, with injected patterns, documented assumptions |
| 8. Validation | Offline metrics vs. baselines on held-out users and time; robustness to noise; planner back-test; proposed A/B pilot on governed upay data |
| 9. Scale | Data and API contracts mirror a real wallet backend; pilot plan; governance plan |

### 8.4 Capability map: how Sathi covers the Track 03 opportunities
| Layer | Track 03 opportunity covered | Implementation |
|---|---|---|
| **Understand** | AI Financial Health Coach, "I don't understand these transactions" | Categorizer + metrics engine + plain-Bangla summary |
| **Predict** | Cash-Flow Forecasting | LightGBM quantile forecast (p10/p50/p90) with shortfall probability and trough date |
| **Plan** | Personal Savings Planner, Financial Goal Copilot | Monte Carlo over forecast uncertainty, 3 plan options with trade-offs |
| **Act** | Smart Spending Companion, "How can I reduce cash-outs?" | Repeat cash-out pattern detection, replaceability score, fee impact |
| **Access** | Inclusive Financial Assistant | Bangla-first UI, starter chips, typed input (P0); voice input (P1) |
| *Stretch (P2)* | Responsible Credit Readiness, Literacy Personalizer | Explainable consistency signals only, with no approval or denial |

### 8.5 Scope tiers (the tracker's hour gates are authoritative)
| Tier | Contents | Target |
|---|---|---|
| **P0 must ship** | Walking skeleton; synthetic data; categorizer; forecast + shortfall probability; goal planner (3 options); Bangla grounded chat with starter chips and template fallback; deployed backend and web URL; **green APK Release**; offline demo bundle; README (10 items); video; report | ~hour 50 |
| **P1 should** | Cash-out detector with fee math; voice input (native plugin, typed fallback); "Why this advice?" panel; fairness table; effects toggle and polish | ~hour 56 |
| **P2 only if time** | Credit-readiness signals; anomaly detection (Isolation Forest); second language | **Cut at hour 56** if behind |

Gates from T+0: P2 cut line hour 56 · feature freeze about hour 62 (after it: bug fixes, README, evaluation report, report and video only) · submit at least 2 hours before the deadline, never in the last hour.

**Cut list:** real authentication, real payments integration, LLM fine-tuning, microservices, a release-signed APK, iOS build. Use a modular monolith.

---

## 9. Architecture `[DECISION]`

`context/architecture.md` is authoritative; this is the summary.

### 9.1 Principles (mirror the non-negotiables)
1. The **LLM never computes money.** It routes intent, calls typed tools, and narrates results.
2. Business logic lives in `core/` as **pure, tested functions** (no I/O, network, DB, clock reads or unseeded randomness).
3. **Money is integer paisa.** The API returns both the integer and a `display` string; the UI renders `display` and never computes, reformats or animates figures.
4. Every insight response carries an **`evidence` block** with labelled figures: Data, Prediction, Assumption, Generated text.
5. A **numeric validator** checks that every number in an LLM answer exists in the tool outputs. It fails closed to a deterministic Bangla template.
6. **Forecasts are ranges plus a probability**, never a single point.
7. **LLM tools have no `user_id` argument.** The orchestrator injects it from the verified token.
8. Config-driven (personas, goal types, fee rates, language) so on-site updates plug in quickly.
9. **Fallback by design:** if the backend is asleep or the phone is offline, the app shows a bundled demo snapshot with a visible "Demo data, not live" label. The app never shows a blank screen.

### 9.2 Data flow
```
Synthetic data (seeded) → Feature layer → ML models (forecast, categorizer)
                                        → Deterministic engines (planner, rules, metrics)
                                                 ↓ structured JSON + evidence
                         LLM (tool-calling): Bangla intent routing + narration only
                                                 ↓
                      Validator (numbers in answer ⊆ numbers from tools) → template on failure
                                                 ↓
          FastAPI (HTTPS, rate-limited) ⇄ Next.js static UI (web URL, and inside the Android APK)
```

### 9.3 Repository structure
```
/sathi
  /config          # YAML: tunable values and named assumptions
  /data_gen        # persona simulators, injected patterns, seeds
  /core            # pure functions: money, formatting, amount parser, metrics, categorizer, planner, cash-out logic
  /ml              # features, training (offline only), evaluation, artifacts, inference wrappers
  /api             # FastAPI routers, Pydantic schemas, services, repositories, auth stub
  /llm             # tools, versioned prompts, templates, validator, sanitizer, provider adapters
  /web             # Next.js static export
    /lib/native    # the only place Capacitor plugins are imported (each with a web fallback)
    /android       # generated Capacitor project (protected)
  /tests           # unit, property, evaluation, security
  /docs            # assumptions, risks, model_card, data_contract, eval_report, third_party, perf
  /context         # agent instructions and specs/
  /.github/workflows
  CLAUDE.md  AGENTS.md  CONTEXT.md  README.md
```

### 9.4 Technology choices
| Area | Choice | Reason |
|---|---|---|
| Backend | FastAPI + Pydantic | Typed contracts, auto OpenAPI docs |
| Storage | SQLite + Parquet (seed data rebuilt on start); Postgres only if hosting gives it free | Zero ops. Ephemeral disk is a documented limitation for demo data |
| Forecast | LightGBM quantile regression (p10/p50/p90) | Fast, calendar-aware, measurable vs. baseline |
| Planner | Monte Carlo on forecast residuals / scenario sampling | Honest probabilities, not LLM guesses |
| Categorizer | Rules + small classifier (logistic regression or LightGBM) | Explainable and quick |
| Anomaly (P2) | Isolation Forest per user | Simple, matches track guidance |
| LLM | Provider-agnostic wrapper with tool-calling, per-token rate limit, daily spend cap, kill switch | Swap on quota or latency issues; the API is public because the APK is |
| Amount parsing | **Deterministic parser in `core/`** ("৩০ হাজার", "30k") plus user confirmation | The LLM never parses money |
| Voice | Native Capacitor speech-recognition plugin (`bn-BD`) behind `web/lib/native/`, with typed fallback | Web Speech API is unreliable in Android WebView. Server-side STT (Whisper) is P2 and has a privacy cost |
| Frontend | Next.js **static export** (`output: "export"`, `webDir: "out"`), Tailwind + shadcn/ui (Radix), Lucide icons | Same build feeds the web URL and the APK. No API routes, server actions, middleware or dynamic routes |
| Native shell | Capacitor (Android), debug-signed APK | See §14 |
| Fonts | Inter + Hind Siliguri, bundled locally | Works in airplane mode, no CDN |
| Hosting | Static web: Vercel, Netlify or GitHub Pages (decide at T+0). Backend: Render / Fly / Railway free tier | Live URL is mandatory. **Deploy the backend before the first real APK** |
| CI/CD | GitHub Actions: lint, test, deploy, APK build, Release | Continuous history and a reproducible APK |

### 9.5 Security and responsible-AI design
- **Prompt injection:** sanitize counterparty names and reference text before they reach the LLM; pass them only inside a delimited data block, never as instructions. Tools take typed arguments only. The model cannot call tools for another user (the orchestrator injects `user_id`)
- **Data leakage:** no PII in LLM calls; synthetic IDs only; log redaction. **No secrets in the APK or web bundle** (only `NEXT_PUBLIC_*` values); grep the built `out/` for key prefixes
- **Access control:** short-lived per-user demo token from the auth stub; per-user scoping in every repository call
- **Abuse control:** per-token rate limit, daily LLM spend cap with kill switch that falls back to templates
- **Transparency:** each insight tagged **Data / Prediction / Assumption / Generated text** (icon plus text, never colour alone)
- **No manipulation:** no spend nudges, no upsell, no urgency or guilt copy, fee comparison shown as a configurable assumption, essentials safety buffer respected when recommending savings
- **Human oversight and no harmful automation:** Sathi produces information and plans. It never moves money and never approves or denies lending. Credit signals (if built) are informational and say so. Out-of-scope requests (loans, investment advice, moving money) get a fixed refusal template with a gentle redirect

---

## 10. Finance reasoning: the core problem `[DECISION]`

### 10.1 The problem in one sentence
Most MFS users have access to financial *services* but not financial *control*. It is a **liquidity-management problem faced by people with no treasury function**: income arrives at one time, obligations at another, and the gap is invisible until they are already in it.

### 10.2 Who has it
Garment workers, ride-share/rickshaw drivers, small shopkeepers, remittance-receiving households, students. Shared traits:
- Irregular or lumpy income (salary delays, daily earnings, remittance bursts)
- Fixed, front-loaded obligations (rent, bills, installments, family transfers)
- Thin or no buffer (a few days of essentials)
- No planning tools (no budget, cash-flow statement or forecast)

Result: **consumption volatility.** Comfortable in week 1, stressed in week 4 even when monthly income is adequate.

### 10.3 The cost
- The month-end gap is financed through expensive routes: informal borrowing (often with strings), high-cost credit, skipping essentials, breaking savings goals
- **Early warning has value:** knowing 7 to 10 days ahead lets a user shift a payment, trim discretionary spend, or ask for an advance
- Three leakages: **(1) cash-out fees** on frequent small withdrawals, **(2) impulsive spending** is easier with physical cash than with wallet balance (behavioral effect, stated as a hypothesis), **(3) data invisibility:** cash leaves the digital system, so no financial footprint builds for future credit access

### 10.4 Behavioral and structural causes
No visibility (raw lists are meaningless) · mental accounting and present bias (money feels abundant right after income) · no "pay yourself first" habit · trust in cash by habit · literacy gap (terms like "emergency fund" are abstract)

### 10.5 Finance functions AI performs
| Function | Finance concept | What AI adds |
|---|---|---|
| See | Cash-flow statement, categorization | Plain-language category insights |
| Anticipate | Liquidity risk forecasting | Range forecast and P(shortfall) |
| Plan | Goal-based saving, consumption smoothing | Plan fitted to this person's variability |
| Act | Cost reduction, behavior change | Flag avoidable cash-outs with fee impact |

**It must NOT:** make lending decisions, give investment advice, move money, or push products.

### 10.6 Metric definitions (the engine computes these; the LLM does not)
- **Savings rate** = (income − spending) / income
- **Income volatility** = coefficient of variation of monthly inflow
- **Buffer days** = liquid balance / average daily essential spend
- **Cash dependency ratio** = cash-out value / total outflow
- **Fee leakage** = total fees paid / total spending
- **Fixed-commitment ratio** = recurring obligations / income
- **Month-end trough** = lowest forecast balance in the cycle
- **P(shortfall)** = probability that balance < essential-need threshold before next income

The essential-need threshold, the salary-day rule and the "essentials" category set are **named assumptions** in `config/` and `docs/assumptions.md`, never hardcoded.

### 10.7 Hero persona: Rina `[ASSUMPTION]` (all values illustrative)
Garment worker, salary ৳18,000 arriving ~7th of each month.

| Item | ~Amount/month | Timing |
|---|---|---|
| Rent | ৳5,000 | ~8th |
| Utilities + mobile | ৳1,500 | 10th to 12th |
| Money to family | ৳2,000 | ~10th |
| Food + transport | ~৳7,000 | Daily |
| Other | ~৳2,000 | Mixed |
| **Total outflow** | ~৳17,500 | |
| **Average surplus** | ~৳500 to ৳2,500 | |

Injected behaviors: ~65% of spending in days 7 to 14 → low balance around days 25 to 30; ~10 cash-outs per month of ~৳1,000 each, several followed by merchant purchases where digital is accepted; occasional late salary; occasional one-off shock.

Illustrative fee math (the fee rate is a **configurable assumption**; check the real upay tariff): at an assumed 1.5%, 10 × ৳1,000 → ~৳150/month, ~৳1,800/year.

### 10.8 Worked goal example: "Save ৳30,000 in 6 months"
Required ৳5,000/month vs. realistic surplus ~৳1,500 → the honest answer is **"not feasible in 6 months."** Sathi presents (all figures illustrative, produced by the planner, never typed by hand):
- **A:** ৳1,500/month for ~20 months (high reliability)
- **B:** cut ~৳700 of leakage (fees + avoidable spend, with the split shown), save ~৳2,200/month for ~14 months
- **C:** save a percentage of each inflow (e.g., 10% when income lands), which suits irregular earners

Each option shows **P(goal met)** as a range from simulation. **No option is pre-selected or visually promoted; the user decides.** A good planner sometimes says "not that fast" and explains why. That builds trust and is the opposite of manipulation.

### 10.9 Business logic for upay (hypotheses to test, not claims)
| Benefit | Mechanism |
|---|---|
| Higher retained wallet balance | Planners and savers hold float |
| Lower churn, deeper engagement | A helpful product is sticky |
| Trust and differentiation | "Financial partner," not a pipe |
| Future responsible credit | Digital footprint and consistency signals |

**Tension to address openly:** reducing cash-outs reduces cash-out fee revenue. Offsets: digital merchant payments, retained float, lower churn, trust. Recommendations stay transparent about fees and are **not driven by upay's revenue**.

### 10.10 Honest limits
- Partial visibility: the wallet sees only the digital slice. Allow user-confirmed inputs for cash income
- Forecasts always shown as ranges plus a probability
- Output is information and planning support, not regulated advice
- Test fairness across personas and income bands
- Cold start: fall back to persona priors and ask the user to confirm key inputs
- All results are on synthetic data; real validation needs governed data

---

## 11. Synthetic data design `[DECISION]`

### 11.1 Scale
5 personas, ~500 to 2,000 users, 6 to 12 months, **seeded and reproducible** (one explicit `numpy` Generator, sorted before sampling, pinned library versions). Timezone-aware datetimes only (Asia/Dhaka).

### 11.2 Personas
1. Salaried garment worker (hero: Rina)
2. Remittance-receiving household
3. Gig/ride-share driver
4. Student
5. Small shopkeeper

### 11.3 Injected patterns (ground truth for evaluation)
Salary spikes and rent/bill clusters on fixed days · Eid/seasonal spikes · month-end squeeze in a subset · repeat small cash-outs to the same agent followed by digital-capable merchant payments · rare anomalies (unusual large spend) · noise: late salary, skipped weeks, one-off shocks

### 11.4 Rules
- Split by **user and by time**; hold out a clean test set that is never used for training, tuning or threshold selection (tune on a separate validation set)
- Robustness test: increase noise and report degradation
- Detectors that find patterns the generator injected are **sanity checks, not accuracy claims**; label them that way
- State plainly: **metrics are on synthetic data; real validation requires governed data**
- Document every assumption in `docs/assumptions.md` when it is made. Never use real PII

### 11.5 Data contract (minimum viable; full version in `docs/data_contract.md`)
```
users(user_id, persona, age_band, region, income_band, created_at)
transactions(txn_id, user_id, ts, type, amount_paisa, fee_paisa, counterparty_id,
             counterparty_type, channel, balance_after_paisa)
counterparties(counterparty_id, type, category, accepts_digital)
user_goals(goal_id, user_id, target_amount_paisa, deadline, created_at)
```
`type` ∈ {cash_in, cash_out, send_money, payment, bill_pay, recharge, salary_in, remittance_in}
All money columns are **integer paisa**. All timestamps are timezone-aware.

### 11.6 Offline demo bundle
A static snapshot of the tool outputs for every persona (summary, forecast, goal plan, cash-out insights, and the four journey answers) is bundled in the app. It is shown with a persistent "Demo data, not live" label. **Regenerate it whenever the tool-output schema changes.**

---

## 12. Models and evaluation `[DECISION]`

| Component | Method | Metric and baseline |
|---|---|---|
| Cash-flow forecast | LightGBM quantile regression (calendar, lag, rolling, salary-day-proximity features) | WAPE and pinball loss vs. naive/seasonal baseline; p10 to p90 coverage calibration; shortfall alert recall and precision at 7 days lead; results per persona and income band |
| Categorizer | Rules + small classifier | Macro-F1 on the held-out set |
| Cash-out substitution | Pattern mining (repeat counterparty, amount, cadence) + replaceability score | Precision and recall vs. injected ground truth (sanity check) |
| Savings planner | Monte Carlo over forecast distribution; options: raise contribution, extend timeline, trim a category | P(goal met) per option; property test: more time never lowers P(success); **back-test on held-out history: does stated P(goal met) match how often goals were met?** |
| Amount parser | Deterministic rules in `core/` | Bangla and English amount test set ("৩০ হাজার", "30k", "৩০,০০০") |
| Anomaly (P2) | Isolation Forest per user | Recall on injected anomalies (sanity check) |
| LLM layer | Tool-calling, Bangla intents, numeric validator | 30-prompt Bangla test set; 100% numeric consistency; prompt-injection set fails to subvert; out-of-scope refusal tests |

Every model is compared against a naive baseline, side by side. Training runs offline only, never in a request handler. Every artifact is versioned and its version appears in the `evidence` block.

### Impact metrics (all labelled **simulated**)
- Shortfall early-warning recall at 7-day lead (target ≥ 80%)
- Forecast WAPE improvement over baseline (target ≥ 20%)
- Simulated cash-out reduction if recommendations are followed
- Goal-hit probability uplift: recommended plan vs. naive plan
- Numeric consistency of LLM answers (target 100% via validator)
- Fairness: forecast error and plan feasibility per persona and income band
- Prototype: four official journeys completable by a non-technical tester, unaided

### Post-hackathon validation proposal
A/B pilot on governed, anonymized upay data: measure shortfall incidents, goal completion, cash-out frequency, retained balance, 30/60/90-day retention and customer-reported confidence.

---

## 13. API contract (draft) `[DECISION]`

Base URL is baked into the web build and the APK from the repo **variable** `NEXT_PUBLIC_API_URL` (HTTPS only). Money fields are integer paisa with a sibling `display` string.

```
GET  /healthz                         → status, commit hash, model version (also used to wake a sleeping host)
POST /v1/auth/demo-session            → {persona_id} → short-lived token for a synthetic user
GET  /v1/users/{id}/summary           → categories, metrics, plain-language insights
GET  /v1/users/{id}/forecast          → daily p10/p50/p90, shortfall_prob, trough_date
POST /v1/users/{id}/goal-plan         → {target_paisa, months} → 3 options + P(goal met) range
GET  /v1/users/{id}/cashout-insights  → repeat patterns, replaceable share, fee impact
POST /v1/chat                         → Bangla/English message or starter-chip id → grounded answer + evidence
```

**Envelope for every insight response:**
```
{
  "data": { ... },
  "evidence": {
    "items": [ { "label": "data|prediction|assumption|generated", "key": "...", "display": "..." } ],
    "model_version": "...",
    "assumptions": [ "assumption_id", ... ],
    "generated_text": true|false
  },
  "meta": { "request_id": "...", "demo": false }
}
```
- Path `{id}` must match the token's user. Anything else is rejected
- Spoken or typed amounts are parsed by the deterministic parser and confirmed by the user before a plan request is sent
- The contract changes only in a contract-change unit (update the offline demo bundle and tests in the same step)

---

## 14. Android APK delivery and UX `[DECISION]`

### 14.1 Deliverable
An **installable debug-signed APK**, built by GitHub Actions, attached to a **public GitHub Release** (tag `v*`), plus a live web URL. The submission links the Release (workflow artifacts expire and need a login).

### 14.2 Definition of done
1. APK workflow green on `main`.
2. APK attached to a public Release.
3. Installs on the demo phone (unknown sources enabled; Play Protect "Install anyway" is expected) and opens with no white screen.
4. Reaches the live backend over HTTPS and loads data.
5. **Airplane mode:** opens, shows the bundled demo data with the "Demo data, not live" label, does not crash.
6. The four official journeys work end to end (typed input at minimum).
7. Voice works, or typed input shows a clear message.
8. The APK contains no secrets.
9. The live web URL works too.
10. A fresh clone can build from the README alone.

### 14.3 Pipeline notes
- **Prove the pipeline first:** a hello-world APK on the real phone before any feature work. This is allowed before T+0 only as a neutral, generic scaffold in a separate repo.
- Pin Node, JDK and Capacitor majors; match the JDK to what the installed Capacitor Android requires. Record the pins in the tracker. Never upgrade or downgrade toolchain versions "to see if it helps".
- Commit `package-lock.json` (CI uses `npm ci`) and `web/android/`; mark `gradlew` executable and keep it LF via `.gitattributes` (the team works on Windows).
- Workflow needs `permissions: contents: write` to publish Release assets.
- Version code comes from the CI run number; verify the exact `build.gradle` format before relying on `sed`.
- If the backend URL changes, rebuild the APK.
- CORS must allow the web origin and the Capacitor origin (`https://localhost` with `androidScheme: 'https'`).
- No release keystore for the hackathon.

### 14.4 UX decisions (full detail in `context/ui-context.md`)
- **Dark-first, dark-only** for this release. Origin is a visual reference only.
- Glass only on floating chrome (tab bar, scrolled header, sheets, composer, toasts); cards are solid; effects levels `full / reduced / off`; default `reduced`; `off` must be fully usable.
- **Red is for system errors only.** Money pressure uses amber with an icon and a plain sentence. Colour never carries meaning alone.
- Bangla first with an English toggle; bundled fonts; usable at 200% font scale; 48px touch targets.
- Every data view has six states: loading, waking up, offline, empty, error, success.
- Android specifics handled in `web/lib/native/`: back button (close topmost sheet first), safe-area insets, status bar, keyboard resize.
- Design-system work (tokens and glass) is time-boxed to about 4 hours and never displaces P0 AI work.

---

## 15. Work plan (72 hours) `[DECISION]`

**The tracker's numbers win if they differ.** Plan for roughly 35 to 45 productive hours per person, not 72. Every unit ends with a phone check on the latest CI APK. Keep `main` demoable at all times. Commit every 1 to 2 hours.

| WP | Hours | Deliverable | Acceptance test |
|---|---|---|---|
| WP0 | 0–4 | Commit context files; repo, CI; backend hello deployed; **hello-world APK green and installed on the phone** (re-verified if scaffolded earlier); README skeleton; logic chain | Phone opens the app and `/healthz` answers over HTTPS |
| WP1 | 4–10 | Synthetic generator (5 personas, seeded, injected patterns); data contract; assumptions doc started | Same seed gives identical data; plots show salary spikes, the month-end trough, repeat cash-outs |
| WP2 | 10–16 | `core/` money, formatting, amount parser, categorizer, metrics; **thin vertical slice:** summary endpoint → Overview screen → APK on phone | Macro-F1 reported; metrics match hand calculation; Rina's Overview visible on the phone |
| WP3 | 16–26 | Forecast + baselines + shortfall probability; Forecast screen (band plus median) | Beats baseline on WAPE; recall and precision reported; coverage checked; per-persona table |
| WP4 | 26–32 | Goal planner (Monte Carlo, 3 options); Planner screen with equal-weight option cards | ৳30k in 6 months for Rina returns an honest "unlikely" plus alternatives; property tests pass; back-test run |
| WP5 | 32–38 | Cash-out detector + fee impact (P1); Cash-out screen | Precision and recall vs. ground truth (labelled as sanity check) |
| WP6 | 38–46 | LLM layer: tools, validator, templates, sanitizer, refusal, rate limit and spend cap; chat with starter chips | Bangla test set passes; numeric consistency 100%; injection and refusal tests pass; four journeys work with **no LLM** |
| WP7 | 46–56 | Design-system polish (time-boxed), Bangla and English, six states everywhere, offline demo bundle, voice (P1), "Why this advice?" panel, fairness table | Airplane-mode test passes; non-technical tester completes the four journeys unaided |
| **56** | | **P2 cut line** | |
| WP8 | 56–62 | Evaluation report (metrics, fairness, error analysis), perf notes, model card | One metrics table, one fairness table, one "where it fails" section |
| **62** | | **Feature freeze** | |
| WP9 | 62–68 | README (10 items), tests, `docs/third_party.md`, Release `v1.0` APK, video, report, integrity checklist | A stranger builds and runs from the README in under 10 minutes; Release works without login |
| WP10 | 68–70 | Submit | Submitted with at least 2 hours of buffer; never in the last hour |

### Working rules
- Walking skeleton first; never leave the UI until the last day
- One unit touches one boundary; order inside a feature: data and contract → pure logic with tests → ML with baseline → API → LLM tool and validator → UI → phone check
- Deploy the backend before the first real APK; redeploy on every push
- If the APK workflow is red on `main`, fixing it is the next task
- Three failed attempts on one problem, or 90 minutes on a P0 bug: stop, log under Known Issues, decide (simplify, fallback, cut)
- Keep a pre-generated demo scenario, cached template answers and the offline bundle in case of API failure on demo day

### Pre-T+0 vs. post-T+0
| Allowed before T+0 | Wait until T+0 |
|---|---|
| Research, planning, empty app skeleton, Capacitor shell, CI, hello-world APK pipeline, fonts and icons, learning tools (all in a neutral generic repo) | Synthetic generator, forecast, planner, cash-out engine, challenge-specific screens and prompts. Context files stay local and uncommitted until T+0 |

### On-site final day
Read the new requirements fully; write a one-line plan per requirement; implement the smallest change that satisfies each; commit step by step; rebuild and re-verify the APK; stop adding features 20 minutes before the second evaluation and rehearse the demo; no risky changes in the last 30 minutes of the build window. Predicted updates: new persona, new goal type, new language, fairness requirement, new data field, a changed constraint. **Insurance:** config-driven personas, goal-type-agnostic planner, templated prompts, modular `core/`, a working APK pipeline. Prepare a network-failure plan before the day: local backend plus a debug APK pointing to it, the offline demo bundle, or the recorded video.

---

## 16. Demo script (~90 seconds, on the real phone) `[DECISION]`

1. (Voice or starter chip, Bangla) "প্রতি মাসের শেষে আমার টাকা কম পড়ে কেন?" → Sathi shows the biggest-outflow weeks, the forecast band and the likely shortfall window with its probability
2. "৬ মাসে ৩০,০০০ টাকা জমাতে চাই।" → amount confirmation card, then 3 plans with probabilities and trade-offs. It says plainly when the target is not realistic, and no option is pre-selected
3. "ক্যাশ-আউট কমাব কীভাবে?" → repeat cash-outs, which could be digital, fee impact (with the fee assumption visible)
4. Open **"Why this advice?"** → data, prediction, assumption and generated-text labels
5. Switch the phone to airplane mode → the app still opens with the "Demo data, not live" label
6. Close with the fairness table and the validation plan

Fallback: if live voice or network fails, use starter chips and the offline bundle; the recorded video is the last resort.

---

## 17. Anticipated judge questions and prepared answers

| Question | Answer |
|---|---|
| Why AI and not a spreadsheet? | Variance-aware personalized forecasting, simulation-based probabilities, natural-language Bangla grounding |
| Isn't this just a chatbot? | No. The engines (forecast, planner, detector) come first. Chat is one front door, and the four journeys work through starter chips with no LLM at all |
| What if the LLM invents a number? | The validator rejects numbers absent from tool outputs and falls back to a deterministic template; tests prove it |
| Cash-outs earn revenue for upay. Why care? | Retained float, churn reduction, trust, digital footprint, framed as hypotheses to validate; recommendations are fee-transparent |
| Does it work with little data? | Cold-start priors by persona plus user-confirmed inputs |
| Is it fair? | Per-persona and income-band error and feasibility table |
| What changes with real data? | Data contract, API contract and pilot design are already defined |
| Does it manipulate users? | No spend nudges, no urgency or guilt copy, essentials buffer enforced, no upsell, fee transparency, informational credit signals only, red reserved for system errors |
| Are your metrics inflated by synthetic data? | Stated explicitly; noise-robustness test; user and time split; injected-pattern detectors labelled as sanity checks; real validation requires governed data |
| Why an APK, and does it work offline? | The target users are on Android phones. The app opens offline with labelled demo data; live insights need the backend |
| Is the APK safe? | No secrets in the bundle, HTTPS only, per-user scoped tokens, rate limit and spend cap on the public API |
| Can every teammate explain the AI parts? | Each member owns and rehearses one component (forecast, planner, validator and LLM layer, data and fairness) |

---

## 18. Risk register `[DECISION]`

Full register with owners lives in `docs/risks.md`.

| Risk | Mitigation |
|---|---|
| APK pipeline fails late (JDK/Gradle mismatch, `gradlew` permission, `cap sync` skipped, wrong `webDir`) | Hello-world APK green first; pinned versions; CI runs `chmod +x`; recorded in the tracker |
| White screen in the APK (static export problem, JS error) | `output: "export"`, `webDir: "out"`; inspect via `chrome://inspect` or `adb logcat`; no server-only Next.js features |
| API works in browser, fails in APK (CORS, cleartext HTTP, wrong baked URL) | HTTPS only; allow Capacitor origin; debug screen shows the baked base URL |
| Free-tier backend cold start (30 to 60 s) | `/healthz` ping at app start, "waking up" state, timeout then demo data |
| Forecast overfits to the generator | Noise-robustness test, honest baselines, user and time split |
| LLM latency, quota or outage | Template fallback carries all four journeys; kill switch; cached demo scenarios |
| Weak Bangla quality | Reviewed Bangla templates for core insights; the LLM only paraphrases within validator limits |
| Hallucinated financial figures | Tool-only numerics + validator; the UI renders `display` strings only |
| Prompt injection via transaction text | Sanitization, delimited data block, typed tool args, per-user scoping, injection test set |
| Public API abused (APK exposes it) | Per-token rate limit, daily spend cap, kill switch |
| Bangla voice unreliable on the demo phone | Native plugin tested early; typed input and chips are the plan, not an afterthought |
| Bangla text clipped, font scale not reaching the WebView | Test at 200% on the real phone; text-zoom plugin in `web/lib/native/` if needed |
| Glass too slow on low-end phones | Default `reduced`; `off` fully usable; never animate blur |
| Late deployment failure | Deploy at WP0; CI redeploys on every push |
| Scope creep | Tiered scope; P2 cut at hour 56; feature freeze about hour 62 |
| Pre-built-solution accusation (§9.3) | Only generic scaffolding before T+0, in a neutral repo; context files uncommitted until T+0 |
| Single-upload or squashed commit history | Commit step by step; no squash-merge; every member commits |
| Secrets in a public repo or bundle | `.env.example` placeholders only; grep the built bundle; rotate immediately on leak |
| Team member cannot explain the AI parts | Every member owns and rehearses one component |
| Venue network fails on the final day | Local backend plus debug APK, offline bundle, recorded video |

---

## 19. Decision log

| # | Decision | Reason |
|---|---|---|
| D1 | Chose Track 03 only | User focus |
| D2 | Merge opportunities into one product ("Sathi") instead of 8 features | Judges penalize generic and wide; depth wins |
| D3 | Wedge = month-end shortfall early warning + honest goal plans | Measurable, real cost, needs ML |
| D4 | Hero persona Rina (garment worker) | Narrative coherence for demo |
| D5 | LLM narrates, never computes | Guideline rule on decision logic; hallucination safety |
| D6 | LightGBM quantile + Monte Carlo | Calibrated uncertainty, fast, explainable |
| D7 | Modular monolith, deploy day 1 | Live URL mandatory; reduces ops risk |
| D8 | Bangla templates for core insights, LLM paraphrase only | Quality and reliability |
| D9 | Credit readiness is P2, informational only | Avoid harmful automation; scope control |
| D10 | Fee rate is a configurable assumption | No invented upay data; fee transparency |
| D11 | Deliverable is a Capacitor APK from GitHub Actions plus a live web URL | Owner requirement; same codebase serves both |
| D12 | Next.js static export (not Vite, not server-rendered) | Matches `ai-workflow-rules.md` §2 and §3 rule 10; one build feeds web and APK |
| D13 | Debug-signed APK only; no release keystore | Hackathon scope; avoids secret handling |
| D14 | Dark-first, dark-only theme; Origin is a visual reference, Sathi is the brand | Origin brief; OLED glare; easier text-on-glass contrast |
| D15 | Red reserved for system errors; amber for cash-flow pressure | Track 03 forbids anxiety-inducing or shaming design |
| D16 | Money is integer paisa; UI renders API `display` strings | Eliminates float and reformatting errors; validator-friendly |
| D17 | Deterministic amount parser in `core/` plus user confirmation | LLM must not parse money; speech mishears numbers |
| D18 | Voice is P1 via native plugin with typed fallback | Web Speech API unreliable in Android WebView |
| D19 | Offline demo bundle with a persistent "Demo data, not live" label | App never shows a blank screen; cold start and venue network risk |
| D20 | Per-token rate limit, daily spend cap and kill switch | The APK makes the API public |
| D21 | Walking skeleton first; design system time-boxed to about 4 hours | Avoid UI-last failure; protect P0 AI work |
| D22 | Gates: P2 cut hour 56, freeze about hour 62, submit with at least 2 hours of buffer | Align with tracker; fixes v1 inconsistency (P1 at hour 68 contradicted the freeze) |
| D23 | Context files and CONTEXT.md stay local and uncommitted until T+0 | Conservative reading of rulebook §4.1 and §9.3 |

---

## 20. Open questions `[OPEN]`

1. Has T+0 been announced? Exact release time, submission deadline, on-site start time and update window?
2. Team size and roles (backend/ML, frontend and native, product, demo)? Who owns which AI component for judging?
3. **Demo phone:** model, Android version, RAM, and whether Bangla speech recognition works on it?
4. LLM provider and API, budget, and daily spend cap value (or open models only)?
5. Hosting accounts and choices: static web host, backend host (Render/Fly/Railway), cold-start strategy?
6. Hardware: GPU or CPU only? (CPU is sufficient for this plan.)
7. Detailed score weighting of evaluation 1 vs. evaluation 2?
8. Submission channel and file formats? Will a GitHub Release link be accepted for the APK?
9. Actual upay cash-out tariff and any public product constraints, to use as a documented assumption?
10. Secondary "AI voice" accent colour: the Origin spec was truncated at "Soft R…". Currently cyan is used for both primary accent and AI voice. Add a second token?
11. Does Android font scale reach the Capacitor WebView on the demo phone (decides whether a text-zoom plugin is needed)?
12. Does `full` glass run smoothly on the demo phone (decides whether `reduced` stays the default)?
13. Does the T+0 brief differ from the earlier track guideline? If so, re-scope before coding.

Resolved from v1: stack comfort (FastAPI + Next.js static), deployment shape (static web + separate backend + APK), theme (dark-first).

---

## 21. Immediate next actions

1. Confirm the T+0 status in `context/progress-tracker.md`. Until it is confirmed, write no challenge-specific code.
2. Before T+0 (neutral generic repo only): empty Next.js static-export shell + Capacitor + hello-world APK workflow + backend hello deploy. Install the APK on the demo phone.
3. Answer the open questions in §20, starting with 1, 2 and 3.
4. At T+0: commit the context files as the first commits, re-verify the pipeline (WP0), then start WP1: persona definitions (Rina's income and outflow calendar with every assumption labelled) and the seeded generator with tests.
5. Fill `docs/assumptions.md` and `docs/third_party.md` as you go, not at the end.

---

## 22. Glossary
- **MFS:** Mobile Financial Services
- **upay:** the MFS partner/sponsor of this hackathon (a UCB initiative)
- **Cash-out:** converting wallet balance to physical cash via an agent
- **Paisa:** the integer unit for all money in code (1 taka = 100 paisa)
- **WAPE:** Weighted Absolute Percentage Error
- **Pinball loss:** the loss function for quantile forecasts
- **p10/p50/p90:** 10th, 50th and 90th percentile forecast values
- **Buffer days:** days of essential spending the liquid balance can cover
- **Evidence block:** structured metadata that makes every answer traceable (labelled Data, Prediction, Assumption, Generated text)
- **Display string:** the API's pre-formatted figure (digits, ৳, grouping) that the UI renders verbatim
- **Walking skeleton:** a thin end-to-end slice (data → API → screen → APK on phone) built before deepening any layer
- **Capacitor:** the wrapper that packages the static web build as an Android app
- **Static export:** Next.js build mode that outputs plain HTML, JS and CSS with no server features
- **FDE:** forward-deployed engineer (builds with the client in mind, contracts first)