# Architecture Context

System structure, boundaries, storage, access model, AI components, deployment, failure handling and invariants for **Sathi (সাথী)**.
Read after `project-overview.md`. If implementation changes anything here, update this file **before** continuing.
**§15 (Invariants) is the single source of truth.** Other files summarize it and must not diverge from it.

Rule priority (from `ai-workflow-rules.md`): hackathon rulebook > the APK deliverable > invariants > everything else.

Hackathon hygiene: this file is Sathi-specific. Keep it **local and uncommitted until T+0** (rulebook 4.1, 9.3), then commit it as one of the first commits of the window.

---

## 1. System Summary

Sathi is a **modular monolith backend** (Python, FastAPI) and a **static web frontend** (Next.js export) wrapped by **Capacitor** as an installable Android APK. The APK and the plain web build call the same HTTPS API. The LLM sits **on top of** deterministic engines. It routes intent and narrates results, and it never computes money.

```
        OFFLINE (developers / CI)
 data_gen/ ─► dataset (seeded) ─► ml/ (features → train → evaluate) ─► versioned model artifact + metadata.json
     │                                                                    │
     └─► make demo-bundle ─► web/public/demo/*.json (API-shaped, flagged synthetic)
                                                                          ▼
        ONLINE (request path)                                   ml/ inference only
 Android APK (Capacitor) ─┐
 Web build (Vercel)      ─┼─HTTPS─► api/ (FastAPI) ─► core/ (pure engines)
        │                 │              │
        │ backend down    │              └─► llm/ (sanitizer → orchestrator → tools → validator → template fallback)
        └─► bundled demo  └──────── evidence-bearing JSON responses
            data (labeled)
```

Reference flow from the guideline: **INPUT → INTELLIGENCE → ACTION**. Synthetic data → feature and context layer → ML/AI engine → explanation or recommendation → user decision → measurable outcome.

**Deliverables the architecture must serve (rulebook §6-7):** public GitHub repo with continuous history, README with ten items including a **live URL**, demo video, project report. **Product deliverable:** GitHub Actions builds a debug-signed APK, published on a public GitHub Release, that installs on an Android phone, uses the deployed backend, and still opens usefully offline.

---

## 2. Stack

| Layer | Technology | Role | Status |
|---|---|---|---|
| Backend language | Python 3.11+ | Data generation, ML, engines, API | DECISION |
| API | FastAPI + Pydantic v2 | Typed contracts, OpenAPI docs, validation | DECISION |
| Data | pandas, NumPy, PyArrow | Dataset handling, features, Parquet IO (frozen test set only) | DECISION |
| ML | LightGBM (quantile objective), scikit-learn | Cash-flow forecast. Optional anomaly detector (P2) | DECISION |
| Simulation | NumPy (seeded Generator passed in) | Monte Carlo goal planning, forecast path sampling | DECISION |
| Operational store | **SQLite only** (WAL mode) | Users, transactions, goals, spend counter | DECISION (Postgres cut) |
| LLM access | Provider-agnostic `LLMClient` with tool-calling | Bangla/English intent routing and narration | DECISION. Provider **OPEN** |
| Frontend | Next.js static export (`output: "export"`) + React + TypeScript (strict) | All screens, client-side data fetching | DECISION |
| Client validation | zod | Validate every API and demo-bundle response | DECISION |
| UI primitives | Tailwind CSS + shadcn/ui (Radix) + lucide-react | Accessible components, tokens, icons | DECISION |
| Fonts | Noto Sans Bengali (or Hind Siliguri) + Inter, **bundled locally** via `next/font/local` | Bangla glyphs, offline-safe | DECISION |
| Native shell | Capacitor (Android) | Installable APK around the static build | DECISION |
| Native bridge | Capacitor plugins wrapped in `web/lib/native/` | Haptics, speech, status bar, keyboard, back button, splash | VERIFY (names and versions in Unit 01b) |
| Motion / sheets | `motion` library, shadcn Drawer (vaul) | Springs, drag-to-dismiss sheets | VERIFY (WebView behavior in Unit 19b) |
| Voice | Capacitor native speech-recognition plugin (`bn-BD`) on Android. Browser Web Speech only for the plain web build | Speech to text. Only text reaches Sathi's server | VERIFY |
| Offline demo data | Static JSON bundled in the app (`web/public/demo/`) | Demo continues with no backend or internet | **[NEW]** DECISION |
| Auth (prototype) | Signed short-lived JWT for synthetic demo users | Per-user scoping | DECISION |
| Testing | pytest, hypothesis, ruff, mypy, ESLint, vitest, manual device checks | Unit, property, evaluation, security | DECISION |
| CI/CD | GitHub Actions | Lint, test, deploy, **build APK, publish Release** | DECISION |
| Hosting | Frontend on Vercel. Backend on Render, Fly or Railway | Live URL is mandatory | Host **OPEN** (Q16) |
| Logging | Structured JSON logs with request IDs | Debugging, no PII | DECISION |

Add a dependency only in the unit that first needs it, and record it in `docs/third_party.md`.

**Version pins [CHANGED]:** pin one Capacitor major, and the Node and JDK versions its docs require (expected: Node 20+, JDK 21, but confirm in Unit 01b). Record the pins in `progress-tracker.md`. Never bump versions to "see if it helps".

**Theme (light or dark) is not decided here.** See `ai-workflow-rules.md` §5 and `ui-context.md`. Nothing in the architecture depends on it.

---

## 3. System Boundaries

```
/                         repo root
  CLAUDE.md  CONTEXT.md  README.md  .gitignore  .gitattributes  .env.example  Makefile
  config/        Tunable values and assumptions (YAML). No code
  data_gen/      Persona simulators, injected patterns, seeded generator, demo-bundle builder
  core/          Pure functions: money, formatting, amount parser, metrics, categorizer, planner, simulation, cash-out logic
  ml/            Features, training, evaluation, artifacts, inference wrappers
  api/           FastAPI app: routers/, schemas/, services/, repositories/, auth
  llm/           Orchestrator, tools, prompts/, templates/, validator, sanitizer, providers/
  web/           Next.js static app
    lib/api/     Typed API client (zod). The ONLY place fetch is called. Owns the offline fallback
    lib/native/  The ONLY place Capacitor plugins are imported
    public/demo/ Bundled offline demo data (generated, flagged synthetic)
    public/fonts/ Local fonts
    styles/      tokens.css, glass.css
    android/     Generated Capacitor project (protected)
  tests/         unit, property, evaluation, security, fixtures
  docs/          assumptions, risks, model_card, data_contract, eval_report, third_party, perf, ideation
  context/       These context files and specs/
  .github/workflows/   ci.yml, android-apk.yml
```

| Folder | Owns | Must NOT contain |
|---|---|---|
| `config/` | Fee rates, thresholds, calendar, `dataset.as_of_date`, persona parameters, goal types, planner and LLM limits | Code, secrets |
| `data_gen/` | Persona definitions, injected patterns, seeded generation, split assignment, offline demo-bundle builder | Training code, API code. Not imported at API runtime |
| `core/` | Metrics, rule-based categorizer, planner, simulation, cash-out logic, fee math, money, formatting, **amount parser** | I/O, network, DB, LLM calls, clock reads, unseeded randomness |
| `ml/` | Feature builders, training, evaluation, artifacts, inference wrappers returning typed results | Business rules, thresholds, HTTP code |
| `api/` | Routing, schemas, auth, composing `core/` and `ml/`, writing `evidence`, DB access via `repositories/` | Financial calculations, SQL inside routers |
| `llm/` | Provider adapters, tool definitions, prompts, Bangla templates, validator, sanitizer, fallback, refusal templates | Financial calculations, thresholds, fee rules, DB access |
| `web/` | Presentation, input, tokens, glass, motion, evidence and label rendering | Business logic, money math, direct LLM calls, plugin imports outside `lib/native/`, `fetch` outside `lib/api/`, secrets |
| `web/lib/api/` | Typed client, timeouts, retries, token handling, **automatic switch to the demo bundle** | UI components. Components never decide the fallback |
| `web/lib/native/` | Typed wrappers over Capacitor plugins, each with a web fallback | UI components |
| `web/android/` | Generated Capacitor Android project | Hand edits outside the APK unit |
| `tests/` | Tests and frozen evaluation fixtures | Production code |
| `docs/` | Written records | Code |

### Allowed dependency direction
```
web → (HTTP) → api → (core, ml, llm, repositories)
llm → (core, ml, repositories) via typed tool functions only
ml  → (core.schemas, config)
core → nothing (config values, clock and RNG passed as arguments)
data_gen → config
```
`core/` is the leaf. It never imports from `api/`, `llm/`, `ml/` or `web/`.

---

## 4. Data Model and Storage

### 4.1 Core entities (full definitions in `docs/data_contract.md`)

```
users(user_id, persona, age_band, region, income_band, created_at)
transactions(txn_id, user_id, ts, type, amount_paisa, fee_paisa,
             counterparty_id, counterparty_type, channel, balance_after_paisa)
counterparties(counterparty_id, type, category, accepts_digital)
user_goals(goal_id, user_id, goal_type, target_amount_paisa, deadline, created_at)
```
- `type` ∈ {`cash_in`, `cash_out`, `send_money`, `payment`, `bill_pay`, `recharge`, `salary_in`, `remittance_in`}.
- Money is **integer paisa** everywhere. Never floats. Field names end in `_paisa`.
- Timestamps stored in UTC, interpreted in `Asia/Dhaka` for calendar logic. Timezone-aware only.
- Identifiers are synthetic only.
- **[NEW] "Today" is `dataset.as_of_date`** (config), the last day of the synthetic window. `api/` passes it into `core/` and `ml/`. The UI shows it as the demo date. Real wall-clock time is never used for forecasts.

### 4.2 What lives where

| Data | Store | Notes |
|---|---|---|
| Generated dataset | Built from the **seed**, loaded into SQLite at build or start | Reproducible. A small bundled sample ships in the repo so judges do not need `make data` |
| User goals created in the app | SQLite | Demo users only. **Lost on redeploy when the host disk is ephemeral** (documented limitation) |
| Frozen held-out test set | Parquet + recorded seed and hash | Protected. Never used for training, tuning or threshold choice |
| Model artifacts | `ml/artifacts/<model>/<version>/` with `metadata.json` (data hash, seed, config hash, git commit, metrics, baseline metrics) | No registry service. No binaries in the DB |
| Forecast and insight outputs | Computed on request, optionally memoized in process memory | No cache table. Memo key: `(user_id, model_version, config_hash, as_of_date)` |
| LLM spend counter and kill switch | SQLite table plus an env override | Resets on redeploy, so it is **not the only cap**. Also set a hard monthly limit in the provider dashboard |
| Evaluation reports | `docs/eval_report.md` and `docs/metrics/*.json` | Regenerated by `make eval` |
| **[NEW] Offline demo bundle** | `web/public/demo/<persona>.json`, built by `make demo-bundle` from the real API response schemas | Flagged `"synthetic": true, "demo": true`. Covers every persona. Rebuilt whenever a response schema changes. Validated by zod at load |
| Demo-day LLM fixtures | `tests/fixtures/` | Cached answers for provider failure. Never used to bypass the validator |
| Secrets | Host environment variables. `.env` locally (git-ignored) | **Never in the repo, the web bundle or the APK** |
| API base URL | Repo variable **`NEXT_PUBLIC_API_URL`**, baked into the web and APK build | Public value, not a secret. Same name everywhere |

No real customer data exists anywhere in this system.

### 4.3 Offline demo bundle contract **[NEW]**
- Contains, per persona: summary, transactions (first page), forecast, cash-out insights, goal-plan results for the **preset scenarios** (including ৳30,000 in 6 months), and template answers for the four official journeys.
- Every value was produced by the backend and carries its `evidence` block. The client does no money math (invariant 19).
- **Offline mode answers only precomputed scenarios.** Custom goal input and free-text chat are disabled with a plain message ("ইন্টারনেট ছাড়া শুধু ডেমো উদাহরণ দেখা যাবে"). Offline mode never fakes a live computation.
- A persistent **Demo data** chip and banner show whenever the bundle is in use.

---

## 5. Auth and Access Model

The APK makes the API **public**. Treat every endpoint as exposed to anyone.

- **Token:** `POST /v1/auth/demo-login` issues a short-lived JWT for a **synthetic** demo user. Subject claim = `user_id`. The route is open, because the data is synthetic, and it is rate-limited.
- **Scoping [CHANGED]:** all personal data routes are under **`/v1/me/...`**. `user_id` comes only from the verified token. **No route accepts a user id for data access.**
- **LLM tools** have **no `user_id` parameter**. The orchestrator injects the authenticated user server-side.
- **Rate limits:** per-token and per-IP on `/v1/chat`, `/v1/parse-amount` and `/v1/auth/demo-login`. An in-memory limiter is acceptable for a single instance. Note it in `docs/risks.md`.
- **Request limits:** maximum message length and body size enforced by Pydantic and the server.
- **LLM spend cap:** a daily cap, a **kill switch** (`LLM_ENABLED=false` or cap reached), and a hard provider-side limit. When tripped, the API serves template answers only. This is **P0**.
- **CORS:** allow the deployed web origin, the local dev origin, and the Capacitor origin (`https://localhost` with `androidScheme: "https"`) **[VERIFY in Unit 01b]**.
- **Transport:** HTTPS only. Android blocks cleartext by default, so no `http` backend URL.
- **Secrets:** read through one settings module. No secret appears in code, logs, the web bundle or the APK. Only `NEXT_PUBLIC_*` values are bundled.
- **Roles:** only `customer`. No analyst role in the prototype.

---

## 6. AI Components

Every component has a baseline or a deterministic fallback.

| Component | Type | Location | Input → Output | Baseline / fallback |
|---|---|---|---|---|
| Categorizer | **Rules with reason traces** (a classifier is cut: circular on rule-generated synthetic labels) | `core/` | Transaction fields → category + reason | n/a (it is the baseline) |
| Cash-flow forecaster | Hybrid: known income windows and recurring obligations as structure + LightGBM quantile regression (p10/p50/p90) on the residual | `ml/` | Daily features → quantiles | Naive (last-cycle) and seasonal-naive |
| Path simulator **[NEW]** | Seeded block bootstrap of residuals, scaled by the model's predicted spread | `core/simulation.py` | Quantiles + residual history + RNG → balance paths | Pure function, RNG passed in |
| Shortfall estimator | Deterministic over simulated paths | `core/` | Paths + essentials threshold (config) → `P(shortfall)`, trough date | Pure function |
| Goal planner | Monte Carlo over forecast uncertainty | `core/` | Goal, horizon, surplus distribution, RNG → options with `P(goal met)` | Plain arithmetic plan |
| Cash-out detector (P1) | Pattern mining + replaceability score | `core/` | Cash-out history + `accepts_digital` → repeat patterns, fee impact | Rule-only repeat detection |
| Amount parser | Deterministic grammar | `core/` | "৩০ হাজার", "ত্রিশ হাজার", "30k" → paisa + ambiguity flag | Typed amount entry |
| LLM orchestrator | Tool-calling LLM | `llm/` | Message → tool calls → narration | Deterministic Bangla template |
| Out-of-scope router | Rules plus LLM intent | `llm/` | Loan, investment or money-movement request → fixed refusal with redirect | Refusal template |
| Validator | Deterministic | `llm/` | Draft + tool outputs → pass or fail | Fails closed to template |
| Anomaly detector (P2) | Isolation Forest | `ml/` | Per-user features → score | Z-score rule |

### 6.1 Forecast design
- **Target:** daily net flow per user, modeled as structure + residual. Known salary window and recurring obligations are explicit features. The ML model predicts the **residual** quantiles. One pooled model with user and persona features.
- **Features:** day of month, days to and from the expected income window, weekday, lagged and rolling inflow and outflow, recurring-obligation flags, festival flag from the config calendar.
- **Paths:** simulate balance paths by **bootstrapping residual blocks that keep day-to-day correlation** (block length from config). Do **not** sample each day independently from p10/p50/p90, because that understates cumulative variance and makes `P(shortfall)` too optimistic.
- **Low-data users** (for example the student persona): fall back to persona priors from config, mark the forecast confidence `low`, and ask the user to confirm inputs.
- **Shortfall label:** at day *t*, positive if the balance falls below the essentials threshold within N days before the next income. N and the threshold come from `config/` and are labeled ASSUMPTIONs.
- **Alert cutoff** is chosen on the **validation** set, never on test. Report precision as well as recall (false alarms cause real anxiety).
- **Evaluation:** WAPE, pinball loss, p10-p90 coverage, shortfall recall and precision at a 7-day lead, per persona and income band, noise-robustness curve, always against baselines, on user-level and time-level splits.
- **Honesty:** because the generator injects the patterns the model learns, results are labeled **simulated** and are not accuracy claims about real customers.

### 6.2 Planner design
- Inputs: target (paisa), horizon (months), surplus distribution from the forecast, essentials safety buffer (config).
- Up to three options: (A) extend timeline, (B) trim a named leakage category, (C) percent-of-inflow saving. Each returns monthly amount, `P(goal met)`, and a structured trade-off.
- If the request is unlikely, say so with the number. No flattering rounding.
- **Back-test:** replay held-out history and compare stated `P(goal met)` with how often goals were actually met (calibration).
- Property tests: more time never lowers `P(goal met)`. A higher contribution never lowers it.
- Never recommend a contribution that breaches the essentials safety buffer.
- Monte Carlo has a capped sample count, a timeout and a seeded RNG passed in.

### 6.3 LLM layer flow
```
user message (typed, or transcript the user edited and confirmed)
  → POST /v1/parse-amount (core/ deterministic) → "Did you mean ৳৩০,০০০?" confirmation
  → out-of-scope router (loan / investment / move money → refusal template)
  → sanitizer (strip control chars, cap length, neutralize instruction-like text)
  → orchestrator (versioned prompt, tool schemas, max tool calls, timeout)
  → LLMClient (provider adapter; skipped when kill switch is on)
  → tool calls (typed args, user_id injected) → core / ml / repositories → structured results + evidence
  → LLM drafts narration from tool results only
  → validator
        pass → LLM narration + evidence, "Generated text" chip shown
        fail / timeout / error / kill switch → Bangla template rendered from the same tool results, no "Generated text" chip
```
- Every figure the user may need is in tool output, including percentages, dates and ranges. The LLM does no arithmetic.
- **Validator** normalizes Bengali digits (০-৯), `৳`, commas and units. It extracts every numeric token and date in the draft. Each must match a tool-output value or a formatting-only transform from the **one shared formatter** in `core/formatting.py`. Anything else fails closed.
- Bangla templates for core insights live in `llm/templates/bn/` and need native-speaker review.
- Prompts are versioned files in `llm/prompts/`. The prompt version is recorded in `evidence`.
- Untrusted text (counterparty names, notes) enters the prompt only through the sanitizer, in delimited data fields.
- No PII and no real IDs go to any provider.
- The four official journeys also run through **starter chips that call tools directly** with templates, with no LLM at all.

---

## 7. API Surface

Base path `/v1`. All routes need auth except `/healthz`, `/v1/demo-users` and `/v1/auth/demo-login`.

```
GET  /healthz                      → status, api version, git commit, model versions, config hash, self-check
GET  /v1/demo-users                → list of synthetic personas for the picker (id, persona label bn/en)   [open, cheap]
POST /v1/auth/demo-login           → token for a synthetic demo user (rate-limited)
GET  /v1/me/summary                → categories, metrics, plain-language insights
GET  /v1/me/transactions           → paginated, each with category + reason trace + plain-language label
GET  /v1/me/forecast               → daily p10/p50/p90, shortfall_prob, risk_level, trough_date
POST /v1/me/goal-plan              → {goal_type, target_paisa, months} → options + P(success)
GET  /v1/me/cashout-insights       → repeat patterns, replaceable share, fee impact                  (P1)
POST /v1/me/goals                  → explicit user-initiated save of a plan (stores a record only)
POST /v1/parse-amount              → {text} → {amount_paisa, display, ambiguous}  (deterministic, rate-limited)
POST /v1/chat                      → message → grounded answer + evidence + tool outputs used        (P1 free text)
GET  /v1/meta/model-card           → model versions, metric summary, limitations, assumptions        (P1)
```

Rules:
- Pydantic schemas are the contract. OpenAPI is published at `/docs`.
- **No endpoint moves money, approves or denies anything.** `goal-plan` computes and returns. Saving a goal is a separate explicit write that stores a plan and nothing else.
- Success shape: `{ "data": {...}, "evidence": {...} }`. Error shape: `{ "error": { "code": "STABLE_CODE", "message_bn": "...", "message_en": "...", "request_id": "..." } }`. No stack traces, paths or SQL in errors.
- Every money or probability value is returned as both a raw value and a `display` string produced by the shared formatter. The UI renders `display`. It does not format.
- `/healthz` must be cheap and must not wake heavy resources. The app pings it at launch.
- A contract change is its own unit: `docs/data_contract.md`, schemas, zod types, the demo bundle and tests change together.

### 7.1 Evidence block (every response with insight or numbers)
```json
{
  "evidence": {
    "data_used": {"window": "...", "as_of_date": "...", "n_transactions": 0, "source": "synthetic"},
    "model_version": {"forecast": "fc-...", "categorizer": "rules-v1"},
    "config_hash": "…",
    "assumptions": [{"id": "FEE_CASHOUT_RATE", "value": 0.0, "label": "ASSUMPTION"}],
    "labels": {"balance_range": "Prediction", "monthly_income": "Data", "fee_rate": "Assumption"},
    "generated_text": false,
    "prompt_version": null,
    "validator": {"passed": true, "fallback_used": false}
  }
}
```
Label values are exactly: `Data`, `Prediction`, `Assumption`, `Generated text`. The `Demo data` chip is added by the client when it serves the offline bundle.
Values above are placeholders. Real values come from `config/` and `docs/assumptions.md`. The fee rate must come from upay's published tariff with a cited source and date, or stay a clearly labeled placeholder.

---

## 8. Execution Model: Offline vs Online

| Work | Where | Rule |
|---|---|---|
| Data generation | `make data` | Seeded, deterministic |
| Demo bundle generation | `make demo-bundle` | Calls the same service layer as the API. Run after any schema change |
| Training and evaluation | `make train`, `make eval` | Never in a request handler |
| Inference | Online, in request | Artifacts loaded at startup, bounded latency |
| Goal planning | Online | Capped samples, timeout, seeded |
| LLM calls | Online | Bounded timeout and tool-call limit, always a fallback |

There is no job queue. A task that misses the latency budget becomes an offline precompute step.

---

## 9. Configuration

All tunable values live in `config/*.yaml`, loaded once into an immutable settings object. A config hash is included in `evidence`. Final key names are set in Unit 02.

Examples: `dataset.as_of_date`, `fees.cash_out_rate`, `fees.digital_payment_rate`, `thresholds.essentials_per_day`, `thresholds.shortfall_horizon_days`, `risk.low_cutoff`, `risk.high_cutoff`, `calendar.income_windows`, `calendar.festival_days`, `personas.*`, `goal_types.*`, `planner.n_simulations`, `planner.timeout_s`, `simulation.block_length_days`, `llm.max_tool_calls`, `llm.timeout_s`, `llm.daily_cap`, `locale.default`.

**Backend environment variables (names only, placeholders in `.env.example`):** `APP_ENV`, `DATABASE_URL`, `AUTH_SECRET`, `ALLOWED_ORIGINS`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_ENABLED`, `LLM_DAILY_CAP`, `GIT_COMMIT`.
**Frontend build-time (public only) [CHANGED]:** `NEXT_PUBLIC_API_URL`. In CI it comes from the repo **variable** `NEXT_PUBLIC_API_URL`. No secret is needed for the debug APK.

---

## 10. Deployment Topology

```
Android phone: Sathi APK (Capacitor, debug-signed) ─┐
Browser:       Vercel web build ────────────────────┼─ HTTPS ─► Backend host (api + core + ml + llm + SQLite)
        │ (backend unreachable → bundled demo data) │                      │
                                                    │                      └─► LLM provider (HTTPS, tool-calling)
GitHub Actions ─ builds APK → artifact; on v* tags → public GitHub Release (judges' download link)
```

- **Order:** deploy the backend first, set `NEXT_PUBLIC_API_URL`, then build the APK. After any backend URL change, **rebuild the APK**.
- **APK pipeline (`android-apk.yml`):** checkout → require `NEXT_PUBLIC_API_URL` → Node → JDK → `npm ci` → `npm run build` (static export to `web/out`) → `npx cap sync android` → set version code from the run number → `./gradlew assembleDebug` → upload artifact → on `v*` tags, publish a **Release** (`permissions: contents: write`) so judges get a login-free link. The submission links the Release. Exact JDK, Gradle and `build.gradle` details are **VERIFY** items for Unit 01b.
- The backend image includes the seeded dataset and model artifacts, or builds them from the fixed seed at deploy time.
- `GET /healthz` returns the git commit so a smoke test can confirm the live deploy matches `main`.
- **Free-tier sleep:** the app pings `/healthz` at launch, shows a waking-up state, and after a timeout falls back to the demo bundle. Warm the server before any demo.
- **Local run path:** one command (Docker Compose or `make run`) starts the backend for venue-network failure. This must exist before the on-site day.

### 10.1 Android specifics **[NEW]**
- Capacitor config: `webDir: "out"`, `server.androidScheme: "https"`, no cleartext traffic, `minSdkVersion 24`.
- Permissions: only `INTERNET` and `RECORD_AUDIO` (added in the voice unit). Anything else needs a recorded reason.
- Back button via the Capacitor App plugin: close the topmost sheet first, then navigate back, then exit only from the root tab. Never trap the user.
- Safe areas: `viewport-fit=cover` plus `env(safe-area-inset-*)`. Edge-to-edge behavior is verified on the real phone (A8).
- Fonts and the demo bundle ship inside the APK. Nothing is loaded from a CDN.
- Debug-signed APK by default. Play Protect may warn on install, and the README documents "Install anyway".
- `web/android/` is committed. `gradlew` keeps its executable bit and LF endings (`.gitattributes`).

---

## 11. Failure and Degradation Architecture

The system is designed to keep delivering value when parts break. **The app never shows a blank screen.**

| Failure | Detection | Degraded behavior | User sees |
|---|---|---|---|
| LLM provider down, slow, rate-limited | Timeout, error, 429 | Template answers for all four journeys | Normal answer, no "Generated text" chip |
| LLM spend cap reached or kill switch on | Counter or env flag | Templates only | Same, no error |
| Validator rejects a draft | Validator result | Template from the same tool output | Same |
| Backend asleep | First call slow, `/healthz` slow | Waking-up state, retry with backoff, then demo bundle after timeout | "সার্ভার চালু হচ্ছে…" then Demo data banner |
| No network on phone **[CHANGED]** | Fetch failure | **Offline demo bundle** with the Demo data chip. Custom goals and free chat disabled with a message | "ডেমো ডেটা, লাইভ নয়" |
| Backend down on demo day | Smoke test | Local backend path, bundle, or recorded video | n/a |
| Voice recognition unavailable, denied, or wrong | Plugin result | Typed input, editable transcript, amount confirmation | Plain message |
| Blur too slow on the phone | Device test | Effects `reduced` or `off`, fully usable | Slightly flatter UI |
| Model artifact missing or version mismatch | Startup check | Refuse to start the forecast route, `/healthz` reports it, other routes keep working | Clear error state, bundle still available |
| Low-data persona | Feature check | Persona priors, confidence `low`, "please confirm" prompt | Honest low-confidence label |
| Unfinished feature at the cut line | Gate review | Hidden behind a config flag, not shipped half-working | Feature absent |
| Redeploy wipes saved goals | Known limitation | Seed data rebuilds on start | Documented in the README |

**Startup self-check:** on boot, the API verifies config loads, the artifact version matches `metadata.json`, the dataset hash matches, and the DB is reachable. Failures appear in `/healthz` and in the logs.

---

## 12. Security and Responsible-AI Architecture

| Concern | Control |
|---|---|
| Privacy | Synthetic data only. No PII in code, logs, prompts, fixtures, the demo bundle or the APK |
| Speech privacy | Sathi's server receives text only. The Android or browser speech service may process audio, and this is disclosed in `docs/risks.md`. Typed input is always available |
| Prompt injection | Sanitizer, delimited data fields, typed tool args, server-injected `user_id`, fail-closed validator, injection test set |
| Public API abuse | Rate limits, request-size limits, spend cap, provider hard limit, kill switch, demo-login throttle |
| Data leakage | Per-user scoping from the token only (`/v1/me/...`). Logs redact message bodies by default |
| Access control | No route takes a user id. A token for user A cannot read user B (tests prove it) |
| Secrets | None in repo or client bundle. Secret scanning in CI (gitleaks). Grep the built `out/` for key prefixes before release |
| Explainability | Evidence block on every insight. Rule trace for categorization and cash-out flags |
| Transparency | Labels Data, Prediction, Assumption, Generated text, plus Demo data, rendered in the UI |
| Fairness | Per-persona and per-income-band error and plan-feasibility reporting. Volatility metrics normalized per user so irregular earners are not mislabeled. Gaps reported, not hidden |
| Human oversight | Sathi informs and plans. No automated financial action. Credit readiness (P2) is informational |
| No manipulation | No upsell, urgency, guilt, alarming haptics or hidden fees. Fees are visible labeled assumptions. Savings advice respects the essentials buffer |
| Out-of-scope requests | Fixed refusal templates for loans, investments and money movement |

---

## 13. Observability

- Structured JSON logs: request ID, route, latency, status, model and config versions. No message bodies by default.
- Counters: LLM calls, validator rejections, fallback rate, tool-call count, spend, rate-limit hits.
- `/healthz` reports versions and startup self-check results.
- The app has a hidden debug screen showing the baked-in API URL, app version, `/healthz` result and whether the demo bundle is active. It is the first thing to open when the APK misbehaves.
- No dashboard is built.

---

## 14. Extension Points (for on-site updates)

New requirements arrive after pre-evaluation (rulebook §8). These seams make changes cheap:

| Likely change | Where it plugs in |
|---|---|
| New persona | `config/personas/` plus a `data_gen/` persona class, then `make demo-bundle` |
| New goal type | Entry in `config/goal_types`. The planner takes goal type as data |
| New language | `llm/templates/<lang>/`, locale file, validator digit table |
| New data field | Contract-change unit: `docs/data_contract.md` → schema → generator → features → zod → bundle |
| New fee or threshold | `config/` only |
| New insight | New pure function in `core/`, new tool in `llm/`, new route field, new evidence label |
| New fairness or explainability requirement | `ml/` per-group report, evidence panel |
| New screen | New route in `web/`, no backend change unless data is needed |

On the final day, rebuild the APK and re-run the four-journey phone check after every change. Keep the APK pipeline working at all times.

---

## 15. Invariants

Each violation is a bug even if the demo works. **Critical** invariants (C) may never be waived. Others may be waived only by a recorded decision.

1. **(C) The LLM never computes money.** Every figure originates in `core/` or `ml/` and reaches the user through tool output.
2. **(C) No unvalidated LLM text reaches the user.** Failure falls back to a deterministic template.
3. **(C) `core/` is pure.** No I/O, network, DB, clock reads, global state, unseeded randomness, or imports from `api/`, `llm/`, `ml/`, `web/`. Clock and RNG are passed in.
4. **No business rule lives in a prompt, a model or the UI.** Fees, thresholds and eligibility-style rules live in `config/` and `core/`.
5. **Every response with insight carries an `evidence` block** (model version, config hash, assumptions, labels, generated-text flag).
6. **(C) Forecasts are distributions.** Any user-facing prediction includes a range and a probability.
7. **(C) User scoping is server-side.** `user_id` comes from the verified token. No route takes a user id. LLM tools cannot accept it.
8. **Request handlers do not train models or run unbounded jobs.** Simulations have a capped sample size and timeout.
9. **(C) Money is integer paisa** in storage, in `core/` and in API payloads. No floats for money.
10. **Data generation is deterministic.** Same seed and config give identical data. The held-out test set is frozen and never used for training, tuning or threshold selection.
11. **Every model ships with a baseline comparison, a calibration check and a per-persona result** before it is wired to the API.
12. **(C) No endpoint moves money, approves or denies anything.** Sathi informs and plans only.
13. **(C) No secrets and no real PII** in the repository, logs, fixtures, LLM prompts, web bundle, demo bundle or APK.
14. **Every assumption is named, configurable and recorded.** No hidden constants. No invented upay facts.
15. **Every LLM-backed feature has a working non-LLM path.** The product runs end to end with the provider off.
16. **Savings advice never breaches the essentials safety buffer.** No recommendation uses urgency, shame or upsell framing.
17. **(C) No secrets in any client bundle.** Only public values such as `NEXT_PUBLIC_API_URL`.
18. **The frontend is a static export.** No server-only Next.js features: no API routes, server actions, middleware or dynamic routes.
19. **The UI never displays a figure the API did not return.** No count-up, interpolation or client-side money math. Demo-bundle figures were produced by the backend.
20. **Every screen is usable with effects `off`.** Glass and motion are enhancements, never required for comprehension.
21. **Capacitor plugins are imported only in `web/lib/native/`,** each with a web fallback. `fetch` is called only in `web/lib/api/`.
22. **The APK pipeline always works on `main`.** A broken APK build is treated like a broken deploy.
23. **(C) Hackathon integrity:** no challenge-specific code before T+0 is confirmed, a continuous commit history, a public repo, and disclosure of significant external components.
24. **Amounts from speech or text are parsed deterministically in `core/` and confirmed by the user** before they are used in any plan.
25. **The app never shows a blank screen.** Backend down, LLM down or offline, it falls back to the labeled demo bundle or a clear message. The bundle is regenerated whenever a response schema changes.
26. **Android: HTTPS only, minimum permissions** (`INTERNET`, `RECORD_AUDIO`), debug-signed APK, and the APK link for judges is a public GitHub Release.

---

## 16. Open Architecture Decisions

| # | Question | Default if unanswered |
|---|---|---|
| A1 | LLM provider and budget (Q4) | Provider-agnostic client, cheapest tool-calling model that handles Bangla acceptably. Test in the first hours |
| A3 | Backend host (Q16) | Choose by cold-start behavior and ease of CI deploy |
| A4 | Real upay cash-out and digital-payment tariff (Q8) | Placeholder ASSUMPTIONs, then cite upay's official published tariff with the date |
| A6 | Whisper or server-side speech fallback | Not built. Typed input is the fallback |
| A7 | Exact Capacitor speech plugin and compatibility (Q17) | Verify in Unit 01b on the demo phone |
| A8 | Android safe-area and edge-to-edge behavior with the installed Capacitor version | Verify in Unit 01b |
| A9 | Whether the Capacitor origin is `https://localhost` | Verify in Unit 01b by a real request from the APK |
| A10 | JDK and Gradle versions required by the installed Capacitor | Verify in Unit 01b |
| A11 | Theme: dark or light (see `ai-workflow-rules.md` §5) | Blocks Unit 19a. Not an architecture matter |
| A12 **[NEW]** | Value of `dataset.as_of_date` and the festival calendar dates for the synthetic window | Set in Unit 02 and document in `docs/assumptions.md` |

(A2 and A5 are absent as in your draft. Numbers are kept as they were, in case other files cite them.)
## 7 October 2026: current deployed chat configuration

The implemented Next.js server app uses `web/src/lib/server/aiProvider.ts` for shared Groq, OpenRouter and OpenAI chat. `SATHI_AI_PROVIDER` selects one account; no cross-provider retry occurs on errors. Server keys remain server-only, destinations are fixed, and each request has a bounded timeout. The owner Copilot retains numeric grounding; `/api/v1/chat` retains slot rendering and numeric validation. Missing keys, quota/network failures and rejected drafts retain computed answers. Personal OpenRouter keys remain device-local and skip shared server generation. `GET /api/ai/status` returns only configuration metadata, without provider calls. Earlier static-export descriptions are historical; hosted ledgers are stored server-side, and enabled AI sends the question and relevant evidence to its provider.
