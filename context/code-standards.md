# Code Standards

Implementation rules for **Sathi (সাথী)**: Python (FastAPI) backend, Next.js **static export** frontend wrapped by Capacitor as an Android APK.
These are rules, not suggestions. Read with `architecture.md` (boundaries; **§15 is the invariant list**), `ai-workflow-rules.md` (workflow, debugging) and `ui-context.md` (visual tokens).
If code needs to break a rule here, update this file first and record the change in `progress-tracker.md`.

Rule priority: hackathon rulebook > the APK deliverable > invariants > this file > style preferences.

Hackathon hygiene: this file is Sathi-specific. Keep it **local and uncommitted until T+0** (rulebook 4.1, 9.3), then commit it as one of the first commits of the window.

---

## 1. General

- Keep modules small and single-purpose. One file, one responsibility.
- Fix root causes. Do not layer workarounds, flags or special cases on top of a bug.
- Do not mix unrelated concerns in one function, component or route.
- Prefer clear, boring code over clever code. **Every team member must be able to explain every line during judging** (rulebook §4.5, §9.4). If nobody on the team can explain a technique, do not use it.
- Name things by domain meaning: `shortfall_probability`, `cash_dependency_ratio`, not `p` or `ratio2`.
- No dead code, no commented-out blocks, no unused dependencies, no `TODO` without a matching entry in `progress-tracker.md`. Delete them.
- No hidden constants. Every financial value is read from `config/`.
- Comments explain *why*, not *what*. Public functions state inputs, outputs and units (paisa, days, probability 0-1).
- Handle errors at the boundary where they can be understood. Never swallow an exception. No bare `except`. No empty `catch`.
- Do not copy code you cannot attribute. Use only licensed libraries and record each in `docs/third_party.md`, **including the AI coding tools used** (rulebook §4.4, §9).
- Never weaken, skip or delete a test to make a build pass. If the spec is wrong, change the spec first.

---

## 2. Money, Dates, Numbers (cross-language)

- **Money is integer paisa** in storage, `core/`, API payloads and TypeScript types. No floats for money. Field names end in `_paisa`.
- **Rates are not floats.** Config stores rates as strings or basis points. `core/money.py` parses them to `Decimal` or integer basis points and applies them with integer or `Decimal` arithmetic. Rounding is **half up to the nearest paisa**, in exactly one function (`apply_rate`).
- Probabilities are floats in `[0, 1]` internally. Only the formatter turns them into percentages.
- **[CHANGED] "Today" is `dataset.as_of_date`** from config (the last day of the synthetic window). `api/` passes it into `core/` and `ml/`. Real wall-clock time is never used for forecasts, goal deadlines or "days until payday".
- Dates and times are stored in UTC and interpreted in `Asia/Dhaka` for calendar logic (month end, salary window, week boundaries). Use `zoneinfo` and **add the `tzdata` package to dependencies**, because `Asia/Dhaka` lookups fail on slim Docker images and on Windows without it. **Timezone-aware datetimes only.** Naive datetimes are a bug. Test month boundaries and the 28/29/30/31-day cases.
- **One shared formatter**, `core/formatting.py`: paisa → `৳30,000` (or Bengali digits `৩০,০০০`), probability → percentage, date → locale string. The API returns a `display` string next to every raw value. The validator and the UI both rely on it.
- **Amount parsing is deterministic and lives in `core/`** (`core/amounts.py`): "৩০ হাজার", "ত্রিশ হাজার", "30k", "30,000" → paisa. It handles Bengali digits and number words, and it returns "could not parse" or an ambiguity flag instead of guessing. The UI always shows "আপনি কি ৳৩০,০০০ বোঝাতে চেয়েছেন?" before an amount is used. The LLM never parses amounts. **[NEW] The frontend contains no amount parser.** It calls `POST /v1/parse-amount`.
- Round for display only. Never round before a calculation.
- The frontend **never computes, reformats, animates or interpolates** money or probabilities (invariant 19). It renders the `display` string.

---

## 3. Python (`data_gen/`, `core/`, `ml/`, `api/`, `llm/`)

### Tooling
- Python 3.11+. Type hints on every function signature.
- `ruff` for lint and format. `mypy --strict` on `core/`, `api/`, `llm/`. `ml/` and `data_gen/` may be looser, but no untyped public function.
- Dependencies are pinned (`pyproject.toml` with a lock, or `requirements.txt` with exact versions). Add one only in the unit that first needs it, and record it in `docs/third_party.md`.
- Settings come from **one settings module** (pydantic-settings) reading environment variables. No `os.environ` reads scattered through the code.

### Style
- Data containers are `@dataclass(frozen=True)` or Pydantic models. No loose dicts crossing a module boundary.
- Use `Enum` or `Literal` for closed sets (`TransactionType`, `Persona`, `InsightLabel`, `RiskLevel`).
- Functions stay small: about 40 lines or three nesting levels is the limit before splitting.
- No global mutable state. No side effects at import time.

### Errors and logging
- Define a small exception hierarchy (`SathiError` → `ValidationError`, `NotFoundError`, `ForbiddenError`, `UpstreamError`). Routers map them to the stable error codes in §7. Unexpected exceptions become a generic `INTERNAL` error with a request ID. No stack trace goes to the client.
- Structured JSON logs with request ID, route, latency, status, model version and config hash. **Never log message bodies, prompts, tokens or secrets.** Log levels: `info` for requests, `warning` for fallbacks, `error` for failures.
- **Every outbound call has a timeout** (LLM provider, any HTTP). Retries are bounded (at most 1 to 2) with a fixed backoff, and never on non-idempotent writes.

### `core/` specifics
- Pure functions only. Same input gives the same output. No I/O, network, DB, clock reads or unseeded randomness.
- **Current date (`as_of_date`), RNG and config values are arguments.** Monte Carlo and bootstrap code lives in `core/simulation.py` and receives a seeded `numpy.random.Generator` from the caller.
- No imports from `api/`, `llm/`, `ml/` or `web/`.
- Every function has unit tests with **hand-calculated expected values** (write the arithmetic in the test comment).
- Property tests (hypothesis) for the planner: more time never lowers `P(goal met)`, and a higher contribution never lowers it, other things equal. Use a fixed seed so these tests are not flaky.
- Edge cases always tested: zero income, negative balance, goal in the past, a very large goal, empty history, one transaction, all-cash user.
- The categorizer is **rules with a reason trace**. Every category result returns the rule that fired.

### `ml/` specifics
- Training, evaluation and inference are separate modules. Training runs only from scripts (`make train`), never from a request handler.
- Every run writes `metadata.json`: data hash, seed, config hash, git commit, metrics, baseline metrics.
- Inference wrappers return typed results (quantiles, version). They contain no thresholds or business rules.
- The alert threshold is chosen on the **validation** set. The frozen test set is read-only.
- Always set and record random seeds. Pin library versions that affect results.
- No model is wired to the API without a baseline comparison, a calibration check and a per-persona result (invariant 11).
- Low-data users (for example the student persona) use persona priors from config and report confidence `low`.

### `data_gen/` specifics
- All randomness goes through one `numpy.random.Generator` built from the config seed and passed down explicitly. Sort before sampling so iteration order cannot change output.
- Each persona is a config-driven class. Injected patterns are named and listed in the dataset metadata.
- Metrics that measure whether a detector rediscovers a pattern the generator injected are **sanity checks, not accuracy claims**. Label them so.
- Never use real names, phone numbers or any real-world identifier.
- **[NEW]** The demo-bundle builder (`make demo-bundle`) calls the **same service layer as the API**, so bundled figures are backend-produced. It never hand-writes numbers.

### `llm/` specifics
- Tools are typed functions with Pydantic argument models and **no `user_id` argument**. The orchestrator injects it.
- Prompts are versioned template files in `llm/prompts/`. No inline prompt strings in application code.
- Bangla insight text lives in `llm/templates/bn/`, taking structured tool output as variables.
- Every LLM-backed function returns `generated_text: bool` and `fallback_used: bool`, and has a deterministic fallback.
- The validator is a pure function `(draft, tool_outputs) -> ValidationResult`. It normalizes Bengali digits, `৳`, commas and units, and **fails closed**. Never loosen it without adding a test.
- All untrusted text passes through the sanitizer and sits in delimited data fields.
- Provider SDKs are imported only in `llm/providers/`.
- Out-of-scope intents (loans, investments, moving money) route to fixed refusal templates.
- Honor the kill switch and the daily spend cap before every provider call.
- Required tests for any change here: the Bangla prompt set, the numeric-consistency test (including Bengali digits), the out-of-scope refusal tests, the injection set, and fallback on provider timeout.

---

## 4. TypeScript

- `strict: true`. No `// @ts-ignore` without a linked reason. No `any`: use interfaces, `unknown` with narrowing, or generics.
- **[CHANGED]** Validate every unknown external input (API responses, **demo-bundle JSON**, speech output, stored settings) at the boundary with `zod`. The zod schemas are the client contract. A contract test parses the demo bundle and a recorded sample of each live response against them. Generating types from OpenAPI is optional, and never worth a blocked morning.
- **[CHANGED]** Prefer union types for closed sets: `type InsightLabel = "Data" | "Prediction" | "Assumption" | "Generated text"`. The `"Demo data"` chip is a separate client-side state, not an API label.
- Named exports everywhere except files Next.js requires to be default exports.
- Public boundaries of components, hooks and utilities are explicitly typed.
- ESLint (Next.js config) and Prettier. **Zero warnings** on `npm run build`.
- No `console.log` in committed code. Use the app logger (it is silent in production and never logs user text).

---

## 5. Next.js, React and the Capacitor App

### 5.1 Static export (non-negotiable)
- `next.config`: `output: "export"`, `images: { unoptimized: true }`, `trailingSlash: true`. The build output is `web/out`, which Capacitor loads.
- **No** Next.js API routes, server actions, middleware, runtime server components or dynamic routes (`[id]`). The selected demo user lives in client state, never in the URL path. Use query parameters only when a URL parameter is unavoidable.
- Pages are statically rendered shells. **All user data is fetched on the client** through the typed API client.
- `"use client"` is the normal case for data screens. Keep components small and push state to the leaves.
- Only `NEXT_PUBLIC_*` values may be used, and they are public by definition. The one used for the backend is **`NEXT_PUBLIC_API_URL`**. **No secret ever enters `web/`** (invariant 17).
- Fonts are bundled (self-hosted through `next/font/local` or CSS `@font-face`). No CDN fonts. Verify offline rendering on the phone.

### 5.2 Data access and offline fallback
- **`fetch` is called only in `web/lib/api/`** (invariant 21). No raw `fetch` in components or hooks outside it.
- The client sets a timeout (about 8 s), maps error responses to typed errors, and distinguishes **offline**, **waking up** (first request slower than about 3 s), **server error** and **validation error**.
- The app calls `/healthz` at launch to wake the backend, and shows the waking-up state if it is slow.
- **[NEW] Offline fallback is owned by `web/lib/api/`.** After the waking-up timeout, or on a network failure, it switches to the bundled demo data (`web/public/demo/<persona>.json`) and exposes a single `source: "live" | "demo"` value. **Components never decide the fallback.** They render whatever the client returns, plus the Demo data chip and banner when `source === "demo"`.
- **[NEW] Offline mode serves precomputed scenarios only.** Custom goal input and free-text chat are disabled with a plain Bangla message. The client never fakes a live computation (invariant 19).
- Retry is user-initiated ("আবার চেষ্টা করুন") except for one automatic retry after the waking-up state.
- Responses are parsed with zod before use. A response that fails parsing is shown as a plain error (or triggers the demo bundle), never rendered half-valid.
- A hidden **debug screen** shows the baked-in `NEXT_PUBLIC_API_URL`, app version, `/healthz` result, whether the demo bundle is active, and the effects level. It is the first thing to open when the APK misbehaves.

### 5.3 Components
- One component, one job. A component that fetches, transforms and renders is three things. Split it.
- No business logic in `web/`. If a component needs a number, the API provides it, with its `display` string.
- Every data view implements **all states**: loading, waking up, offline, empty, error, success (`StateView`). Skeletons for loading. Error text is the plain-language message from the API error schema (`message_bn` or `message_en` by locale).
- Add an error boundary at the app shell so a render error shows a calm message and a reload action, never a white screen.
- Forms: label every field, validate on submit, show inline plain-language errors.
- The browser and the APK never call an LLM provider. They talk to the Sathi API only.
- All user-facing strings live in `web/locales/{bn,en}.json`. No hardcoded strings. Default locale is `bn`.
- A **copy-lint test** scans the locale files and Bangla templates for the banned urgency, guilt and upsell words listed in `ui-context.md` and fails the build on a match.

### 5.4 Native bridge (Capacitor)
- Capacitor plugins (haptics, speech, status bar, keyboard, app/back button, splash) are imported **only in `web/lib/native/`**, each behind a typed interface with a **web fallback**. Components call the wrapper, never a plugin (invariant 21).
- Each wrapper handles "plugin missing", "permission denied" and "not supported" without throwing into the UI.
- Keep plugin major versions aligned with the Capacitor core major. A mismatch makes a plugin work on web and fail on the device.
- **Android back button:** close the topmost sheet or dialog first, then navigate back, and exit only from the root tab.
- **Safe areas:** apply `env(safe-area-inset-*)`. Verify edge-to-edge behavior on the real phone.
- **Keyboard:** the chat composer stays visible above the keyboard. Verify on the phone.
- **Voice:** the transcript is shown, editable and never sent automatically. The amount is confirmed through `POST /v1/parse-amount` and the confirmation line, then sent. Typed input is always available. Speech failing is a normal state, not an error.
- Permissions are only `INTERNET` and `RECORD_AUDIO` (added in the voice unit). `minSdkVersion 24`, `androidScheme: "https"`, no cleartext traffic.
- `web/android/` is generated by Capacitor and edited only in the APK unit. Commit it, keep `gradlew` executable and LF.

### 5.5 Performance
- Lazy-load charts and the Drawer. Keep the initial JS bundle small and report its size in `docs/perf.md`.
- No `backdrop-filter` inside scrolling lists. At most two blur layers on screen. Never animate blur.
- Animate only `transform` and `opacity`.
- Measure on the **real demo phone** and record results in `docs/perf.md`. If scrolling janks, the default effects level drops to `reduced` or `off`.

---

## 6. Styling and Product Feel

Visual tokens (color, type scale, radius, spacing, shadow, glass, motion) are defined in `ui-context.md`. This section governs how code uses them.

### Rules
- Use CSS custom property tokens. **No hardcoded hex, rgb, hsl, pixel radius, spacing, shadow or blur** in components. Only the token files (`tokens.css`, `glass.css`) may contain raw values.
- Tailwind theme maps to the tokens. Do not mix ad hoc utility values and tokens.
- Follow the radius and spacing scales in `ui-context.md`. Do not invent steps.
- Use shadcn/ui on Radix. Generated components in `web/components/ui/*` are **protected**: wrap them, do not edit them.
- **Glass only on floating chrome** (tab bar, assistant pill, top bar after scroll, sheets, composer, toasts), applied through the shared `.glass` classes or `GlassBar`. Content cards, charts, headline numbers, fees and disclaimers are solid.
- Effects are driven by `data-effects="full|reduced|off"` on `<html>` through tokens. Every screen must be usable and legible at `off`. Support `@supports not (backdrop-filter)` the same way.
- Motion constants live in `web/lib/motion.ts`. Respect `prefers-reduced-motion`. No looping animation except skeleton shimmer (and ambient drift at `full`).
- **Numbers appear by fade only.** Never tween a figure. A meter track may animate its width, but its text may not count.
- **Caution is never conveyed by color alone.** Pair a calm amber with an icon and a word. Reserve the error color for hard errors (a failed request), never for "you may run short".
- Phone first: design at 360px, content column centered with the max width defined in `ui-context.md`. No separate desktop layout.
- Touch targets at least 48x48 px. Text contrast meets WCAG AA, **including text over glass at worst-case background**. Respect Android font scale up to 200% with no clipped Bangla.
- Icons are Lucide. No SF Symbols, Apple fonts, logos or any other product's assets. The design reference is inspiration only, and no name, asset or copy is reused.

### Design principles
1. **Calm over busy.** Few elements per screen, one primary action.
2. **One big number, then context.** Open each screen with the figure that matters, one plain sentence, then detail.
3. **Plain language first.** Every chart and metric has a one-sentence Bangla explanation. Avoid jargon.
4. **Soft, rounded solid content cards.** Translucent glass is reserved for floating chrome.
5. **Conversation is a first-class surface.** The assistant is always one tap away, with the four official journeys as starters that work without the LLM.
6. **Ranges, not false precision.** Forecasts are a band with a median, plus the probability in words and number.
7. **Honest trade-offs.** Plans show options side by side with probability and cost. "Unlikely" is said plainly and kindly, and always comes with a next option.
8. **Evidence is one tap away.** "কেন এই পরামর্শ?" shows the label chips: **Data, Prediction, Assumption, Generated text** (and **Demo data** when the bundle is in use).
9. **No dark patterns.** No urgency language, countdowns, guilt copy, upsell, hidden fees or alarming haptics (Track 03 requirement).
10. **Bangla-first, not Bangla-translated.** Test layouts with real Bangla text, taller line height and conjuncts.
11. **Fluid but calm.** Spring motion, drag-to-dismiss sheets and light haptics make the app feel physical. Nothing pulses, counts down or buzzes to create urgency.

### Typography and language
- Bangla-capable font stack from tokens. Bangla body line height at least 1.5. Sizes in `rem`. No letter-spacing on Bangla.
- Never rely on truncation for key figures. Let them wrap.
- Numerals follow the locale setting. The server's `display` string already applies it.
- Bangla copy, especially label wording and risk phrasing, is reviewed by a native speaker before submission.

### Charts
- One chart library, decided in the frontend shell unit and recorded in `progress-tracker.md`. Every chart has a visible plain-language caption, an `aria-label` and a table fallback.
- Forecast chart: median line, p10-p90 band, threshold line, expected-income marker, trough marker, direct labels. No dual axes, no 3D.
- Never use color as the only signal. Use dashes and markers too.

### Accessibility
- Semantic landmarks, one `h1` per screen, visible focus, accessible names on icon buttons, screen-reader sentences for probabilities and charts, `lang` attributes. Test with TalkBack on the phone.

---

## 7. API Routes (FastAPI)

- Validate and parse input with Pydantic **before any logic runs**. Enforce maximum body size and message length.
- **[CHANGED] Personal-data routes live under `/v1/me/...` and take no user id.** `user_id` comes only from the verified token. A route that accepts a user id for data access is a bug (invariant 7). Auth runs before any read or write.
- Routers stay thin: parse, authorize, call a service, attach `evidence`, return. No financial math in routers.
- Database access lives in `api/repositories/`. No SQL in routers or in `core/`. Use parameterized queries only.
- Response shapes:
  - Success: `{ "data": {...}, "evidence": {...} }`
  - **[CHANGED]** Error: `{ "error": { "code": "STABLE_CODE", "message_bn": "...", "message_en": "...", "request_id": "..." } }`
- Error codes are stable strings: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `GOAL_INVALID`, `AMOUNT_UNCLEAR`, `RATE_LIMITED`, `LLM_UNAVAILABLE` (never shown as a failure, the template answer is returned instead), `UPSTREAM_ERROR`, `INTERNAL`. Messages never leak stack traces, paths or SQL.
- Every response with insight or numbers includes the `evidence` block from `architecture.md` §7.1 and `display` strings for money and probabilities.
- **No endpoint moves money or approves or denies anything.** Saving a goal stores a record only and says so.
- **[CHANGED]** Rate limits on `/v1/chat`, `/v1/parse-amount` and `/v1/auth/demo-login`. An in-memory limiter is acceptable for a single instance, noted in `docs/risks.md`. The LLM kill switch and spend cap are checked before any provider call.
- CORS allows only the web origin, the local dev origin and the Capacitor origin (`https://localhost`, verified in Unit 01b).
- `/healthz`, `/v1/demo-users` and `/v1/auth/demo-login` are the only unauthenticated routes. `/healthz` is cheap and returns versions, git commit, config hash and the startup self-check result.
- Routes are versioned under `/v1`. A response-shape change is a contract-change unit: update `docs/data_contract.md`, schemas, zod types, **the demo bundle** and tests together.
- Heavy work is never done in a handler. Simulations use the capped sample count and timeout from config.

---

## 8. Data and Storage

- **SQLite** (WAL mode) holds users, transactions, goals and the spend counter. Access only through repositories. Migrations are scripted and idempotent. No manual schema edits on the deployed database.
- The dataset is rebuilt from the **seed** (`make data`). Commit the seed, config and a **small bundled sample**, not bulky generated files, so a fresh clone runs without extra steps.
- The frozen held-out test set is read-only and protected. Its seed and hash are recorded.
- Model artifacts live in `ml/artifacts/<model>/<version>/` with `metadata.json`. No binaries in the database. Commit only artifacts small enough to ship, or rebuild them at deploy time from the fixed seed.
- Forecast and insight outputs are computed on request. In-process memoization is allowed, keyed by `(user_id, model_version, config_hash, as_of_date)`. There is no cache table.
- **[NEW] The offline demo bundle** (`web/public/demo/*.json`) is generated by `make demo-bundle`, flagged `"synthetic": true, "demo": true`, covers every persona, and is regenerated whenever a response schema or config value that affects output changes. It is committed, because the APK must ship it.
- Saved goals on an ephemeral host disk are lost on redeploy. This is a documented limitation, and seed data rebuilds on start.
- Never store large generated content in the database. Never commit secrets, `.env`, tokens or keystores.

---

## 9. Testing

| Layer | Required tests |
|---|---|
| `core/` | Unit tests with hand-calculated values. Planner property tests (seeded). Amount parser cases (Bengali digits, number words, "30k", garbage, ambiguity). Edge cases from §3. Month-boundary and timezone tests |
| `data_gen/` | Same seed gives identical output. Injected patterns appear at documented rates. No real identifiers |
| `ml/` | Metrics exist and are compared with baselines (or the gap is documented). p10-p90 calibration. Per-persona and noise-robustness results. Planner back-test |
| `api/` | Schema tests. Auth and scoping (token A cannot read user B, no route accepts a user id). Error-shape tests. Evidence-presence tests. Rate-limit and kill-switch behavior |
| `llm/` | Validator tests (Bengali digits, `৳`, commas, dates). Bangla prompt set. Injection set. Out-of-scope refusals. Fallback on provider timeout and on kill switch |
| `web/` | Component tests for every state (loading, waking up, offline, empty, error, success). Zod parse-failure test. **Contract test: demo bundle and sample live responses parse with the zod schemas.** Copy-lint test. Screenshots at effects `full`, `reduced`, `off`. Contrast check including text on glass |
| **Demo bundle** | Covers every persona. Flagged synthetic. Parses with zod. Contains the ৳30,000 in 6 months scenario and the four official journey answers. Regenerated after a schema change |
| Device | **Phone smoke test on the latest CI APK**: install, no white screen, reaches the live backend, the four official journeys, voice or typed fallback, back button, keyboard, safe areas, **airplane mode shows the labeled demo data without crashing**. Record in `docs/perf.md` |
| Repo | A fresh-clone run from the README, timed. Secret scan clean. **Grep the built `web/out` for key prefixes before every release** |

- Tests are deterministic. Seed everything. Mock the LLM provider in unit tests.
- A bug fix includes a regression test (or a documented manual device check when only a device can reproduce it).
- `pytest`, `ruff`, `mypy`, `npm run build` and the secret scan must all pass before a unit closes.

---

## 10. Git, Commits, Branches, CI

- Branch per unit: `feat/NN-feature-name`. Merge to `main` only when the unit's checklist passes. **`main` is always deployable and always builds an APK.**
- **Never force-push or rewrite `main`. Never squash away history.** A continuous commit history is a hackathon rule (rulebook 5.2-5.3). **[NEW] Merge with a merge commit or fast-forward. Never use GitHub's "Squash and merge".** Every team member commits.
- Commit small and often (at least every 1-2 hours). Conventional Commits:
  `feat(forecast): add quantile LightGBM with income-window features`
  `fix(validator): normalize Bengali digits before matching`
  `docs(assumptions): record cash-out fee source and date`
  `test(planner): add monotonicity property test`
  `ci(apk): set versionCode from run number`
- Windows: add `.gitattributes` with `* text=auto eol=lf`. Keep `gradlew` executable (`git update-index --chmod=+x web/android/gradlew`). Commit `package-lock.json`.
- `.gitignore` covers `.env`, `node_modules/`, `web/out/`, build outputs, local DBs, caches. `.env.example` has placeholders only.
- CI (`ci.yml`) runs ruff, mypy, pytest, the web lint, tests and build, and a secret scan (gitleaks). `android-apk.yml` builds the debug APK and, on `v*` tags, publishes a **public GitHub Release** (`permissions: contents: write`). Pin Node, JDK and action versions. Do not change workflows outside the CI or APK units.
- The repo **variable** `NEXT_PUBLIC_API_URL` feeds the web and APK build. It is not a secret.
- Never commit secrets to get past a deploy problem. If a secret leaks, rotate it immediately and note it in `progress-tracker.md`.

---

## 11. File Organization

```
config/            Tunable values and assumptions (YAML). No code.
data_gen/          Persona simulators, injected patterns, seeded generator, demo-bundle builder.
core/              Pure logic: money, formatting, amounts, metrics, categorizer rules, planner, simulation, cash-out logic.
ml/                Features, training, evaluation, inference wrappers.
  artifacts/       Versioned model files + metadata.json.
api/               FastAPI app.
  routers/         One router per resource. Thin.
  schemas/         Pydantic request and response models.
  services/        Compose core + ml + repositories. Attach evidence.
  repositories/    All database access.
llm/               Orchestrator, tools, validator, sanitizer, refusal router.
  prompts/         Versioned prompt templates.
  templates/bn/    Reviewed Bangla templates (en/ alongside).
  providers/       LLMClient adapters (the only place provider SDKs are imported).
web/               Next.js static app.
  app/             Routes and layouts (static pages, no dynamic routes).
  components/      Feature and shared components.
  components/ui/   Generated primitives. Protected.
  lib/api/         Typed API client, zod schemas, offline fallback. The only place fetch is called.
  lib/native/      Capacitor plugin wrappers with web fallbacks. Only place plugins are imported.
  lib/motion.ts    Spring and duration constants.
  locales/         bn.json, en.json.
  public/demo/     Bundled offline demo data (generated, flagged synthetic).
  public/fonts/    Local fonts.
  styles/          tokens.css, glass.css.
  android/         Generated Capacitor project. Protected.
tests/             Mirrors source layout. Fixtures in tests/fixtures/.
docs/              assumptions, risks, model_card, data_contract, eval_report, third_party, perf, ideation.
context/           Context files and specs/.
.github/workflows/ ci.yml, android-apk.yml.
```

### Naming
- Python: `snake_case` modules and functions, `PascalCase` classes, `UPPER_SNAKE` constants.
- TypeScript: `camelCase` values, `PascalCase` components and types, `kebab-case` file names.
- Config keys: `snake_case`, grouped by area (`fees.cash_out_rate`).
- Branches and specs: `NN-kebab-case`.

---

## 12. Definition of Done (per unit) **[NEW]**

A unit is closed only when the full checklist in `ai-workflow-rules.md` §18 passes. In short:

- [ ] `ruff`, `mypy`, `pytest` pass. `npm run build` passes with zero warnings and `web/out` exists. `npx cap sync android` is clean.
- [ ] No hardcoded color, radius, spacing, shadow, blur, money constant or UI string.
- [ ] Every number shown traces to a tool output with an `evidence` block and a `display` string.
- [ ] The demo bundle was regenerated if a response shape changed, and its contract test passes.
- [ ] The unit was checked on the latest CI APK on the real phone, including a no-backend run.
- [ ] `progress-tracker.md` is updated, new assumptions and external components are recorded, and the branch is pushed. `main` is still deployable.