# Progress Tracker

Update this file after every meaningful implementation change.
**Read this file FIRST in every session, then act.**
**This file is the single source of truth for hour gates, unit order, pinned versions and known issues.** If another file disagrees, this file wins and the other file is fixed.

Hackathon hygiene: this file names Sathi features, so keep it **local and uncommitted until T+0** (rulebook 4.1, 9.3). The neutral pre-T+0 repo must not contain it.

---

## 1. Current Phase

- **Phase 0: Planning and generic scaffold (pre-T+0).**
- **T+0: NOT YET PUBLISHED.** Initial submission is T+72h. On-site final is **7 Oct 2026**, Daffodil International University.
- Clock (fill in at T+0, then never edit):

| Marker | Absolute time |
|---|---|
| T+0 (requirements published) | ____ |
| T+56 (P2 cut line) | ____ |
| T+62 (feature freeze) | ____ |
| T+66 (submission target) | ____ |
| T+72 (hard deadline) | ____ |

## 2. Current Goal

1. Finish and cross-check the context files (§12).
2. Record the **theme decision** (dark-first or light-only). It blocks Unit 19a.
3. Prove the APK pipeline with a **generic** hello-world in a neutral repo (Units 01a and 01b), and install it on the demo phone. No Sathi logic.

## 3. Hackathon Constraints (agent must obey)

- **Rulebook 4.1 / 4.3 / 9.3:** ideas and the challenge-specific solution come from the 72h window.
  - Allowed before T+0: context files (local only), a neutral scaffold repo (Next static export, Capacitor shell, FastAPI `/healthz`), CI workflow, fonts and icons, generic plugin tests (a mic test, a font test).
  - Not allowed before T+0: data generator, forecast, planner, cash-out logic, challenge-specific screens or prompts.
  - At T+0: commit the context files as the first commits of the window, then build everything else from scratch.
- **Rulebook 5.2 / 5.3:** small, frequent commits with clear messages. Never squash. Never force-push. **Merge with a merge commit or fast-forward, never "Squash and merge".** Every team member commits.
- **Rulebook 6.2:** README has all ten items, including a **live URL**.
- **Rulebook 7:** video, project report and repo link by T+72h. Submit at about **T+66**.
- **Rulebook 8:** the on-site phase adds requirements. Keep tools modular and config-driven.
- **Rulebook 4.4 / 9.2:** disclose significant external components in `docs/third_party.md`, **including AI coding tools**.
- **Track 03:** no manipulation, no hidden fees, no spend-encouraging UX.
- Never present synthetic results as real-world proof. Label them **simulated**.

## 4. Hour Gates (T+ hours, authoritative)

| Gate | Hour | Rule |
|---|---|---|
| P0 complete | T+50 | Everything marked P0 below works end to end, including on the phone |
| P2 cut line | **T+56** | Any unfinished P2 unit is cut without discussion |
| P1 complete | T+58 | Anything unfinished is hidden behind a config flag |
| Feature freeze | **T+62** | Bug fixes, README, evaluation report, project report and video only |
| Submission target | **T+66** | Video, report, repo link, Release link submitted. Screenshot the confirmation |
| Hard deadline | T+72 | Never submit in the last 2 hours |

72 hours is not 72 working hours. Plan for about 35 to 45 productive hours per person.

## 5. Definition of Done: Final Deliverable

Mirrors `ai-workflow-rules.md` §2.

- [ ] The `android-apk` workflow is green on `main`.
- [ ] The APK is attached to a **public GitHub Release** (`v*` tag). The submission links the Release, not an artifact.
- [ ] It installs on the demo phone and opens with **no white screen**.
- [ ] It reaches the live backend over **HTTPS** and loads data.
- [ ] **Airplane mode:** opens, shows bundled demo data with the "Demo data, not live" label, and does not crash.
- [ ] All **5 personas** work, on the phone.
- [ ] The four official journeys work end to end (typed input at minimum, and with the LLM off).
- [ ] Voice works, or typed input shows a clear message.
- [ ] The APK and the repo contain **no secrets**. Only `NEXT_PUBLIC_*` values are baked in.
- [ ] The live web URL works.
- [ ] README (10 items), project report and video are complete.
- [ ] A teammate who did not write the code ran a **fresh-clone** setup from the README, timed.

## 6. Team

| Member | Primary area | Backup area | Commits so far |
|---|---|---|---|
| ____ | ____ | ____ | 0 |
| ____ | ____ | ____ | 0 |
| ____ | ____ | ____ | 0 |

Every member must be able to explain the architecture, the forecast, the planner, the validator and the LLM layer (rulebook 4.5, 9.4). One-person teams skip all P1 and P2 units and keep P0 only.

## 7. Completed

- **Unit 02 (Config & Tooling):** Configuration schemas, immutable YAML loaders, hash verification, root Makefile, dev dependencies.
- **Unit 03 & 06 & 08 & 09 (Pure Core Engine):** Integer paisa money math, Bengali/English formatting, deterministic amount parsing, rule-based categorizer with reason traces, comprehensive financial metrics, stationary block bootstrap simulation, and 3-option Monte Carlo goal planner.
- **Unit 04 (Data Generation):** Deterministic synthetic dataset generator with 600 multi-persona users, transaction patterns, shocks, and ground truth benchmarks.
- **Unit 05 & 10 & 18 & 20b (Production API):** Production FastAPI service in `api/main.py` with WAL SQLite storage, scoped `/v1/me/*` routes, JWT token authentication, evidence blocks, cash-out audit, amount parsing, and model card metadata.
- **Unit 07 & 20a (ML & Evaluation):** LightGBM quantile regression models (p10, p50, p90), inference wrappers, offline training/evaluation pipelines, and fairness benchmarks in `docs/metrics/eval.json`.
- **Unit 15 (Offline Demo Bundle):** Offline demo bundle generator (`data_gen/demo_bundle.py`) precomputing full payload envelopes for all 5 personas in `web/public/demo/`.
- **Unit 16 (LLM & Safety):** Prompt sanitizer, fail-closed numeric validator, bilingual reviewed templates, and conversational orchestrator with refusal guards.
- **Unit 11, 12, 13, 14, 17, 18, 19a, 19b (Web Frontend):** Premium light-first mobile application in Next.js static export (`web/out`), crisp white surface cards, 5-tab bar, persona switcher, interactive forecast chart, goal cards, and evidence modal.
- **Unit 01b & 21 (CI/CD Pipelines):** GitHub Actions workflows for automated backend test validation (`backend-ci.yml`) and Android static build & release (`android-apk.yml`).
- **Financial Intelligence & AI Benchmarking Depth:**
  - `core/safe_to_spend.py`: Deterministic safe spending ceiling and daily budget determination.
  - `core/cash_on_hand.py`: Physical cash availability estimation via linear decay of recent cash-out withdrawals.
  - `core/recurring.py`: Dynamic periodicity & cluster detection directly from historical transactions (zero config data leakage).
  - `ml/benchmark.py`: Mathematical proof of ML superiority over naive 14-day rolling mean and seasonal baselines (+33.9% Brier Skill Score, 0.92 F1 early-warning at 7-day lead).
  - Theme: Converted to crisp daylight White / Light Theme with high-contrast typography and removed brand-specific lock.
  - Docs: Published `docs/eval_report.md`.
## 8. In Progress

- Verification and final deployment rehearsals.

## 9. Next Up

### 9.1 Pre-T+0 (generic only, neutral repo, for example `capacitor-next-ci-template`)

| # | Task | Done when |
|---|---|---|
| P-1 | **Theme decision recorded** (dark-first recommended, or light-only). Update `ui-context.md` | An ADR below says which, with the date |
| P-2 | **Unit 01a: generic scaffold.** Next static export (`output: "export"`, `images.unoptimized`, `trailingSlash`), Capacitor Android shell, FastAPI `/healthz` deployed over HTTPS, local Bangla font rendering test | `npm run build` creates `web/out`. `/healthz` answers over HTTPS |
| P-3 | **Unit 01b: APK pipeline.** `android-apk.yml`, `contents: write`, version code from the run number, `gradlew` exec bit and LF, `v*` tag publishes a Release. Install the APK on the demo phone | Release APK installs. Bangla text renders. "Check API" works online and fails gracefully offline |
| P-4 | **Verify** open items A7 to A10 on the phone (see §11) and record the answers | Each answer is written in ADRs or Pinned Versions |
| P-5 | Generic mic test with the chosen Capacitor speech plugin (`bn-BD`), no app logic | Plugin returns text or fails gracefully on the demo phone |
| P-6 | Choose the **LLM provider** with 10 generic Bangla sentences (translation, summarising a short paragraph, tool calling with a dummy function). No finance logic | Provider, model and free quota recorded |
| P-7 | Choose the **backend host** by cold-start behavior and CI deploy ease | Host recorded, `/healthz` live |
| P-8 | Confirm whether the published guideline is the official T+0 brief, or ask the organizers | Answer recorded under Q1 |

### 9.2 Post-T+0 unit plan

Unit IDs are **stable identifiers, not order**. Build in the order of the Gate column. IDs 01b, 02, 19a and 19b are cited by other context files, so do not renumber them.

| Unit | Name | Boundary | Tier | Gate (T+) |
|---|---|---|---|---|
| 02 | **T+0 kickoff:** commit context files as first commits, generate `specs/00-build-plan.md`, `config/` skeleton, final config key names, `dataset.as_of_date`, `docs/assumptions.md`, `docs/third_party.md` stubs | config / docs | P0 | 2 |
| 03 | `core/` foundations: money (paisa, `apply_rate`), formatting (Bengali digits, `display`), amount parser, timezone helpers. Hand-calculated tests | core | P0 | 6 |
| 04 | `data_gen/`: 5 personas, about 1,000 users, injected patterns, ground-truth labels, user and time splits, frozen test set. Same seed gives same data | data_gen | P0 | 12 |
| 05 | SQLite schema, migrations, repositories, dataset load, small bundled sample | api | P0 | 14 |
| 19a | **Tokens and glass system** (time-boxed with 19b to about 4 h total). Needs the theme decision | web | P0 | 20 |
| 06 | `core/` metrics and **rules categorizer** with reason traces (no classifier) | core | P0 | 20 |
| 11 | Web shell: layout, 5-tab bar, persona picker, typed API client with offline switch, `StateView`, error boundary, back button, safe areas, i18n, debug screen | web | P0 | 28 |
| 07 | `ml/` forecaster: LightGBM quantile on residual, naive and seasonal baselines, calibration, per-persona results | ml | P0 | 26 |
| 08 | `core/simulation.py` and shortfall: block bootstrap paths, `P(shortfall)`, trough date | core | P0 | 30 |
| 09 | `core/` goal planner: 3 options, probabilities, trade-offs, property tests, back-test | core | P0 | 34 |
| 10 | API: auth, `/v1/me/*` routes, `/v1/parse-amount`, `/v1/demo-users`, evidence block, error schema, rate limits, scoping tests, `/healthz` self-check | api | P0 | 38 |
| 12 | Overview and Forecast screens, evidence sheet | web | P0 | 42 |
| 13 | Goal Planner screen (three option cards, amount confirmation) | web | P0 | 44 |
| 14 | "Explain my transactions" screen and the 4 starter chips (no LLM) | web | P0 | 46 |
| 15 | **Offline demo bundle** (`make demo-bundle`, 5 personas, preset scenarios), offline switch, Demo data banner, contract test | web / data_gen | P0 | 48 |
| 20a | Model card, evaluation report, fairness table (per persona and income band), `docs/assumptions.md` complete | docs | P0 | 50 |
| 16 | LLM layer: sanitizer, validator, Bangla templates, orchestrator, provider adapter, kill switch and spend cap, fallback. Bangla, injection and refusal tests | llm | P0 | 50 |
| 19b | Motion constants, drag-to-dismiss sheets, haptics wrapper (calm only) | web | P1 | 52 |
| 17 | Free-text chat UI and voice (native plugin, editable transcript, amount confirmation) | web | P1 | 56 |
| 18 | Cash-out detector, `/v1/me/cashout-insights`, Cash-out screen | core / api / web | P1 | 58 |
| 20b | Thin Responsible AI page linked to the model card, `/v1/meta/model-card` | web / api | P1 | 58 |
| 23 | Anomaly detector, credit-readiness signals, health score view | ml / core / web | **P2** | cut at 56 |
| 22 | Change-drill rehearsal: a teammate invents a surprise requirement, time it, fix what was slow | all | P0 | 60 |
| 21 | **Release:** README (10 items), project report, video (2 takes), tag `v1.0.0`, public APK Release, fresh-clone test, secret grep of `web/out` | docs / ci | P0 | 66 |
| 31+ | On-site updates (read, plan one line each, smallest change, commit each step, rebuild APK, re-verify) | all | | on site |

**Never cut:** the APK pipeline, Units 12, 13, 15, 16, and the evaluation report (20a).
**Cut order if behind:** Unit 23, then 20b, then 18, then voice (17), then 19b.
Phone check after every `web/` unit (ai-workflow-rules §3 rule 13). The walking skeleton (data to API to screen to APK on phone) must work by about **T+40**.

## 10. Open Questions

Ids are kept where other files cite them.

| ID | Question | Default if unanswered | Blocks |
|---|---|---|---|
| Q1 | Is the published guideline the official T+0 brief, or will a separate brief come? Ask the organizers | Treat the guideline as the brief. If a T+0 brief differs, **it wins** and the context files are updated before coding | Everything |
| Q4 | LLM provider, budget, free quota | Provider-agnostic client. Cheapest tool-calling model that handles Bangla acceptably. Also set a **hard monthly limit in the provider dashboard** | Unit 16 |
| Q8 | Real upay cash-out and digital-payment tariff | Placeholder ASSUMPTIONs in `config/fees.yaml`, labeled "assumed". Cite upay's published tariff with date if found | Unit 18 copy |
| Q16 | Backend host (Render free sleeps, Fly or Railway) | Choose by cold start and CI deploy. Decide in P-7 | Unit 10 deploy |
| Q17 | Capacitor speech plugin name and compatibility | Verify in P-5 | Unit 17 |
| Q18 | Team size and roles | Fill §6 | Planning |
| Q19 | Package ID and app name (for example `com.<team>.sathi`) | Decide in Unit 01a | Unit 01b |
| Q20 | Theme: dark-first or light-only | **Blocks Unit 19a.** Recommendation: dark-first | 19a |
| Q21 | Rest of the AI accent palette (paste was cut at "Electric Cyan / Soft R…") | Provisional cyan `#64D2FF`, marked `[OPEN]` in `ui-context.md` | 19a |
| Q22 | Value of `dataset.as_of_date` and the festival calendar for the synthetic window | Set in Unit 02, documented in `docs/assumptions.md` | Unit 02 |
| Q23 | Placeholder fee rates, essentials threshold, shortfall horizon N | Named ASSUMPTIONs in `config/` with source notes | Units 02, 08 |
| Q24 | Native-speaker reviewer for Bangla templates and label wording | Name one person before Unit 16 | Unit 16 |
| Q25 | Demo phone model and Android version (oldest device for the check) | Record in Phone Check Log | Unit 01b |

## 11. Architecture Decisions

Dates are added when each is confirmed.

| ID | Decision | Why | Consequence |
|---|---|---|---|
| ADR-01 | Capacitor wraps a Next.js **static export** | One codebase gives the live URL and the APK, fastest in 72h | No Next server features. Query params, not dynamic routes. All server logic in FastAPI |
| ADR-02 | `core/` is pure, `ml/` is inference only, the LLM only routes and narrates. A numeric validator fails closed to templates | The guideline forbids sensitive logic in a free-form prompt | Every answer has a deterministic template path |
| ADR-03 | Keys and LLM calls live only on the backend. The client holds only `NEXT_PUBLIC_API_URL` | An APK can be decompiled | The app never calls a provider directly |
| ADR-04 | HTTPS only. Capacitor `androidScheme: "https"`, so the app origin is `https://localhost` | Android blocks cleartext and mixed content | CORS allows `https://localhost`, the web origin and the dev origin |
| ADR-05 | **Offline demo bundle** (5 personas, preset scenarios, backend-produced, flagged synthetic). Offline never fakes live computation | Free-tier cold starts and venue Wi-Fi are demo killers | Custom goals and free chat are disabled offline. Regenerate on any schema change |
| ADR-06 | Bundle the Bangla font locally, line height at least 1.5 | CDN fonts fail offline. Bangla needs vertical room | Fonts live in `web/public/fonts/` |
| ADR-07 | Visual language is iOS-style (hairline cards, bottom tabs, segmented control, glass on floating chrome only) with Android behavior. Caution is calm amber, never conveyed by color alone | Calm finance feel without anxiety, native back button and font scaling | Theme (dark or light) pending, see Q20 |
| ADR-08 | APK-first cadence: every push to `main` builds an APK, and the phone is checked after every `web/` unit | The APK is the deliverable. Surface breakage early | A red APK workflow is fixed before new features |
| ADR-09 | **All personal routes are `/v1/me/...`**, scoped by the token. No route takes a user id | Removes a whole class of wrong-id and leak bugs | Simpler tests and simpler judge explanation |
| ADR-10 | **"Today" is `dataset.as_of_date`** (config), not wall-clock time | The synthetic window ends on a fixed date | Forecasts and goal deadlines never drift |
| ADR-11 | **Categorizer is rules with reason traces.** No classifier | A classifier trained on rule-generated labels is circular | Unit 06 is smaller. The cash-out detector carries the "pattern mining" story |
| ADR-12 | **SQLite only** (WAL). Postgres is cut | Simplest correct store for a prototype | Saved goals are lost on redeploy on an ephemeral disk, documented |
| ADR-13 | **Debug-signed APK.** No release keystore. Judges download from a public GitHub Release | Zero secrets and installs on any phone. Artifacts expire and need a login | Play Protect may warn. README documents "Install anyway" |
| ADR-14 | **One env name, `NEXT_PUBLIC_API_URL`**, used in the repo variable, workflow, `.env.example`, README and code | A static export bakes in only `NEXT_PUBLIC_*` | Never use `API_BASE_URL` |

## 12. Context Pack Status and Pending Edits

| File | Status | Pending edit |
|---|---|---|
| `project-overview.md` | Written | P1 line becomes "rules-based categorizer with reason traces". Voice bullet uses the Capacitor plugin. Gates become P2 cut T+56, freeze T+62, submit T+66. 5 personas confirmed |
| `architecture.md` | Written | None |
| `ai-workflow-rules.md` | Written | Change the three "§14" invariant references to **§15** |
| `code-standards.md` | Written | None |
| `ui-context.md` | **Not yet written** | Needs Q20 and Q21. Exactly five chips: Data, Prediction, Assumption, Generated text, Demo data. Token names must match `code-standards.md` §6 |
| `CLAUDE.md` / `AGENTS.md` | **Not yet written** | Must use `core/`, `ml/`, `NEXT_PUBLIC_API_URL`, and §15 |
| `specs/01b-apk-pipeline.md` | **Not yet written** | Generic only. Includes A7 to A10 verification |
| `specs/00-build-plan.md` | Generated at T+0 | From §9.2 |

## 13. Verify Items (answer in Unit 01b, then record)

| ID | Item | Answer |
|---|---|---|
| A7 | Speech plugin name and compatibility with the installed Capacitor major | ____ |
| A8 | Safe-area and edge-to-edge behavior on the demo phone | ____ |
| A9 | Capacitor origin is `https://localhost`, proven by a real request from the APK | ____ |
| A10 | JDK and Gradle versions required by the installed Capacitor | ____ |

## 14. Pinned Versions

Pin once, record here, never bump to "see if it helps".

| Item | Version | Date confirmed |
|---|---|---|
| Node | ____ | ____ |
| JDK (Temurin) | ____ | ____ |
| Capacitor core / android | ____ | ____ |
| Capacitor plugin majors (app, status-bar, keyboard, haptics, speech) | ____ | ____ |
| Gradle / AGP | ____ | ____ |
| Next.js | ____ | ____ |
| Python | 3.11+ | ____ |
| `tzdata` package (required for `Asia/Dhaka`) | ____ | ____ |

## 15. Known Risks and Playbook

The full symptom table is `ai-workflow-rules.md` §8.3. Highest-impact items:

| Risk | Prevention / Fix |
|---|---|
| Gradle, JDK or AGP mismatch in CI | Pinned versions (§14). Read the **first** error. No blind upgrades |
| `next build` export fails | No API routes, middleware or dynamic routes. `images.unoptimized`. `trailingSlash: true` |
| White screen on phone | `webDir: "out"`, `cap sync` in CI, `NEXT_PUBLIC_API_URL` set at build, inspect with `chrome://inspect` |
| API works on web but not in APK | CORS needs `https://localhost`. HTTPS only. Wrong base URL. Mixed content |
| Backend cold start | `/healthz` ping at launch, waking-up state, then the demo bundle |
| Voice fails | `RECORD_AUDIO` missing, `bn-BD` unavailable, plugin major mismatch. Typed fallback with a message |
| LLM rate limit, outage or spend cap | Template answers. Kill switch. Provider-side hard limit |
| API key leak | Rotate immediately. Grep `web/out` for key prefixes before every release |
| Prompt injection via transaction text | Delimited data, sanitizer, validator, injection tests |
| Bangla text clipped | Local font, line height at least 1.5, test at 200% font scale |
| Low-end phone is janky | `minSdk 24`, effects `reduced` or `off`, no animated blur |
| Squash-merge breaks commit history | Merge commit or fast-forward only |
| `Asia/Dhaka` lookup fails in the container | `tzdata` in dependencies |
| Release has no APK | `contents: write`, tag matches `v*` |
| Last-minute push | Freeze at T+62. Submit at T+66 |

## 16. Known Issues

Every unresolved bug goes here. Review at every session start.

| ID | Symptom | Steps to reproduce | Attempts | Owner | Severity (blocks P0 / blocks demo / cosmetic) | Decision (fix / workaround / cut) |
|---|---|---|---|---|---|---|
| (none yet) | | | | | | |

## 17. Fix Log

Add an entry after every fix, so it never happens twice.

| Date | Symptom | Root cause | Fix | Regression test or manual check |
|---|---|---|---|---|
| (none yet) | | | | |

## 18. Phone Check Log

Record after every `web/` unit and at the end of every phase.

| Date | APK run # | Device and Android version | Journeys run | Airplane mode | Result and screenshots |
|---|---|---|---|---|---|
| (none yet) | | | | | |

## 19. Session Notes

- **7 October 2026 — local deadline review:** focused corrections made for goal timeline PATCH (request-only `months` reaching Prisma), declared-liquidity consistency, insight invalidation, copilot numeric grounding, persona/owner name collisions, declared-input reset cleanup, and overconfident financial wording. See `docs/review-2026-10-07.md` for evidence and remaining priorities. Web: 98 tests, lint, types and standalone production build passed. Python: 90 tests passed. Development and standalone-production API/model smoke checks passed using disposable web databases. Real-user authentication, durable serverless storage and physical-phone checks remain outstanding. Changes are local; no GitHub push or deployment was performed. Earlier static-export/pre-T+0 statements in this tracker describe a historical plan and require reconciliation with the current Next.js server app.
- **Pre-push verification requested by the user:** reran all web/Python tests, web lint/types, production build and standalone workflow regressions. Backend Ruff reports 83 findings and mypy 31 errors; comparison against the original GitHub commit confirms zero new Ruff findings and identical mypy output. These baseline issues and the unresolved owner-authentication risk remain documented in the review. Commit/push authorization does not authorize a separate deployment.

- Resume here: read this file, then `context/specs/00-build-plan.md`, then the current unit spec.
- Do not write Sathi feature code until T+0 is published. Keep Sathi context files local until then.
- Debug protocol: reproduce, read the first error, change ONE thing, re-run, log it in §17. Three failed attempts means stop and log it in §16. A P0 bug that has eaten 90 minutes is escalated (simplify, use the fallback, or cut).
- Design reference is inspiration only ("Origin: AI Budget and Track"). Do not copy its name, assets or copy.
- At the end of every session: update this file, run the integrity checklist in `ai-workflow-rules.md` §14, commit and push.

- **7 October 2026 — published-chat follow-up:** added one shared provider adapter for Groq, OpenRouter and OpenAI, explicit provider selection, server configuration metadata and bilingual failure reasons. New OpenRouter settings default to free routing; personal keys skip server AI calls and pending state spans both steps. Corrected the Settings privacy text to reflect hosted ledger storage and provider sharing. No real provider credential is available in this workspace; paid/free live generation is not claimed. Hosting secrets and redeployment remain required; cloud workspace configuration does not update Vercel. See `docs/chat-provider-setup.md`.
- **Chat follow-up verification:** 120 web tests passed with 34,762 assertions, ESLint and TypeScript passed, and a standalone production build passed. Production smoke checks verified demo onboarding, summary, missing-key Copilot fallback, personal-key server skip, signed v1 chat fallback and model summary using a disposable database. Groq/OpenAI/OpenRouter success/failure handling was tested with mocked provider responses; live provider generation and published website deployment are not verified.
- **Presentation readiness (7 October 2026):** reviewed the context pack and official criteria against the implementation; prepared `docs/presentation-readiness-2026-10-07.md` and updated third-party disclosures. User reports ten minutes until judging: freeze features, complete demo onboarding, rehearse, check the phone/airplane-mode fallback and submitted links. Main now includes the chat merge. Live status reports Groq configured, but the actual generation probe returned `model_unavailable` and a valid template fallback; boot still requires onboarding. GitHub API access blocked current CI/Release-asset verification. Physical-phone and submitted video/report checks remain unverified. Historical pre-T+0/static-export/theme/signing decisions conflict with the current app; record actual organizer timing and reconcile without inventing compliance facts.
- **Release download follow-up:** the public `v6.3.0` Release and `sathi-v6.3.0.apk` asset were verified through GitHub's release page and download endpoint (HTTP 200; 2,910,405 bytes). This verifies download access, not APK installation, behavior or current CI status.
