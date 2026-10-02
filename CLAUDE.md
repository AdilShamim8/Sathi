# Sathi (সাথী): Agent Entry File

This is the entry file. Read it in full at the start of every session, then follow it
into the context files below. Use it as `CLAUDE.md`. For other agents, save an identical
copy as `AGENTS.md` (do not let the two drift).

## Product in One Paragraph

**Sathi (সাথী)** is a Bangla-first AI financial coach for upay customers (AI Hackathon 2026,
DIU CPC x upay, **Track 03: Customer Innovation & Financial Independence**). It uses simulated
wallet transactions to explain cash-flow patterns, forecast short-term pressure, turn savings
goals into feasible plans with trade-offs, and translate transactions into plain language.
The customer stays in control. It never moves money, never approves or denies lending, and
never nudges spending.

**Deliverable:** an installable Android APK built by GitHub Actions and published as a public
GitHub Release, plus a live web URL. Full definition of done is in `ai-workflow-rules.md` §2.

## Application Building Context

Read the following files in order before implementing
or making any architectural decision:

1. `context/project-overview.md`: product definition,
   goals, features, and scope
2. `context/architecture.md`: system structure,
   boundaries, storage model, and invariants
3. `context/ui-context.md`: theme, colors, typography,
   and component conventions
4. `context/code-standards.md`: implementation rules
   and conventions
5. `context/ai-workflow-rules.md`: development workflow,
   scoping rules, and delivery approach
6. `context/progress-tracker.md`: current phase,
   completed work, open questions, and next steps

Then, for the unit you are about to build:

7. `context/specs/NN-name.md`: the one spec for the current unit. If there is no spec, stop and ask for one.

`CONTEXT.md` (if present) is a historical master reference. Where it conflicts with a
`context/` file, the `context/` file wins.

Update `context/progress-tracker.md` after each
meaningful implementation change.

If implementation changes the architecture, scope, or
standards documented in the context files, update the
relevant file before continuing.

## Which File Answers Which Question

| Question | File |
| -------- | ---- |
| What are we building, and what is in or out of scope? | `project-overview.md` |
| Where does this code belong, and what must never be violated? | `architecture.md` (§14 invariants) |
| What should this look like? | `ui-context.md` |
| How should the code be written? | `code-standards.md` |
| How do I work, scope a change, debug, or handle time pressure? | `ai-workflow-rules.md` |
| What is done, what is next, what is broken? | `progress-tracker.md` |
| What exactly is this unit? | `context/specs/NN-name.md` |

## Rule Priority (highest first)

1. The official hackathon rulebook and guideline (`ai-workflow-rules.md` §1). Breaking these can disqualify the team.
2. The deliverable: a working APK from GitHub Actions plus a live web URL (§2).
3. The invariants in `architecture.md` §14 and the Project Rules in `ai-workflow-rules.md` §3.
4. Everything else (polish, extras).

If two rules conflict, follow the higher one and record the conflict in `progress-tracker.md`.
If two `context/` files conflict with each other, **stop and flag it. Do not pick one silently.**

## Gate 0: T+0 Status (check before anything else)

Read the T+0 status in `progress-tracker.md`.

- **T+0 not confirmed:** write **no challenge-specific code**. Allowed: empty app skeleton,
  Capacitor shell, CI, APK pipeline (hello-world only), tooling, fonts, icons.
  Not allowed: data generator, forecast, planner, cash-out logic, challenge-specific screens
  or prompts. Keep all `context/` files and this file **local and uncommitted**. Pre-T+0 pushes
  go only to a neutral, generic scaffold repo.
- **T+0 confirmed:** commit the context files as the first commits of the window, then work
  from the tracker's Next Up list.
- **The T+0 brief differs from the earlier track guideline:** the T+0 brief wins. Stop, flag
  the difference, and update the context files before coding.

## Non-Negotiables (short form; full text in `ai-workflow-rules.md` §3 and `architecture.md` §14)

1. The LLM never computes money. It routes intent and narrates tool output only.
2. No unvalidated LLM text reaches the user. The numeric validator fails closed to a Bangla template.
3. `core/` is pure: no I/O, network, DB, clock reads, or unseeded randomness.
4. Money is integer paisa. The UI renders the API's `display` strings and never computes,
   reformats or animates figures.
5. Every insight carries an `evidence` block with labelled figures (Data, Prediction,
   Assumption, Generated text).
6. Forecasts are ranges plus a probability, never a single point.
7. LLM tools take no `user_id`. The orchestrator injects it from the verified token.
8. No manipulation, no harmful automation, no hidden fees. Sathi never moves money or decides lending.
9. Synthetic data only. Never invent upay facts. Unknowns become named ASSUMPTIONs.
10. No secrets in client code. Static export only. Only `NEXT_PUBLIC_*` values in the bundle.
11. Design tokens only. Every screen must work with glass effects `off`.
12. Capacitor plugins are imported only in `web/lib/native/`, each with a web fallback.
13. A web unit is not complete until it has been checked on the latest APK on the demo phone.
14. The app never shows a blank screen. It falls back to labelled demo data or a clear message.

## Repository Map

| Path | Owns |
| ---- | ---- |
| `config/` | Tunable values and named assumptions (YAML only) |
| `data_gen/` | Seeded persona simulators and injected patterns |
| `core/` | Pure business logic: metrics, categorizer, planner, money, formatting, amount parsing |
| `ml/` | Features, training, evaluation, artifacts, inference wrappers |
| `api/` | FastAPI routers, schemas, services, repositories, auth |
| `llm/` | Tools, prompts, templates, validator, sanitizer, provider adapters |
| `web/` | Next.js static UI, tokens, glass system, offline demo bundle |
| `web/lib/native/` | The only place Capacitor plugins are imported |
| `web/android/` | Generated Capacitor project (protected) |
| `.github/workflows/` | Lint, test, deploy, APK build, Release |
| `tests/` | Unit, property, evaluation, security |
| `docs/` | assumptions, risks, model_card, data_contract, eval_report, third_party, perf |
| `context/` | These instructions, plus `specs/` |

One unit touches one boundary. If a change spans more than one, split it
(`ai-workflow-rules.md` §6).

## Commands

Status: **planned** until the unit that creates them lands. Update this table as each command
is verified, and never document a command that has not been run.

| Purpose | Command | Status |
| ------- | ------- | ------ |
| Install backend deps | `pip install -r requirements.txt` | planned |
| Backend tests | `pytest` | planned |
| Backend lint and types | `ruff check .` and `mypy .` | planned |
| Run backend locally | `uvicorn api.main:app --reload` | planned |
| Generate synthetic data | `python -m data_gen.generate --seed <n>` | planned |
| Train models (offline only) | `python -m ml.train` | planned |
| Install web deps | `cd web && npm ci` | planned |
| Run web locally | `cd web && npm run dev` | planned |
| Build static export | `cd web && npm run build` (output in `web/out`) | planned |
| Sync into Android | `cd web && npx cap sync android` | planned |
| Build APK | by GitHub Actions only (`.github/workflows/android-apk.yml`) | planned |
| Make it executable | `git update-index --chmod=+x web/android/gradlew` | planned |

Required build-time variable: repo **variable** `NEXT_PUBLIC_API_URL` (not a secret).
Server-side secrets (LLM key, auth secret) live only in the backend host's environment.
`.env.example` holds placeholders only.

## Session Start Protocol

1. Read this file, then the context files in the order above.
2. From `progress-tracker.md`, state out loud:
   - the current phase and current goal
   - the **T+0 status**
   - the next unit
   - the open **Known Issues**
3. Confirm the spec for the unit. If there is none, stop and ask.
4. If the APK workflow is red on `main`, fixing it is the next task, ahead of new features.

## Working Rules

- One feature unit at a time. Implement exactly what the spec says.
- No extra features, endpoints, screens, config options or refactors outside the spec.
- Do not add a dependency before the unit that first needs it. Record it in `docs/third_party.md`
  immediately, and list the AI coding tools used.
- If something is ambiguous or missing, add it as an open question in `progress-tracker.md`.
  Ask **one** precise question at a time, with at most two options and a recommendation.
- Debugging follows `ai-workflow-rules.md` §8: reproduce, minimise, read the first error,
  one change at a time. After **three failed attempts**, stop and log it under Known Issues.
  Never upgrade or downgrade pinned toolchain versions "to see if it helps".
- Never disable validation, auth, scoping or the numeric validator to "make it work".
- Never hardcode a demo value to hide a failing engine.
- Priorities: **P0** must ship, **P1** if P0 is done, **P2** is cut without discussion when behind.

## Git Rules (hackathon-critical)

- Work on `feat/NN-feature-name` branches. Merge to `main` with a **merge commit or fast-forward only**.
  **Never use "Squash and merge". Never squash. Never force-push `main`.**
- Commit every 1 to 2 hours, or after every meaningful step. Never batch a day's work into one commit.
- **Conventional Commits**, for example `feat(core): add weekly outflow metric`,
  `fix(api): allow Capacitor origin in CORS`, `docs: update tracker`.
- Every team member commits.
- Never commit secrets, `.env`, real PII, or generated model artifacts unless the spec says so.
- `main` must stay buildable and demoable at all times.

## Protected Files (do not modify unless the unit explicitly says so)

- `web/components/ui/*`, `node_modules/`, lockfiles (except through the package manager)
- `web/android/` and generated Capacitor config (except in the APK unit)
- The frozen held-out test set and its seed configuration
- Trained model artifacts (regenerate through the training pipeline)
- `.env` files and anything containing secrets
- `context/*.md`, **except `progress-tracker.md`**, which you update
- `docs/data_contract.md` and the API schema (only in a contract-change unit)
- `.github/workflows/android-apk.yml` outside the APK or CI units

## Before Closing a Unit

Run the full checklist in `ai-workflow-rules.md` §18. In short: it works end to end, no
invariant was broken, tests and builds are green, every shown number traces to a tool output
with an `evidence` block, the latest APK was checked on the demo phone, docs are in sync, and
the change is committed, pushed, and `main` is still deployable.

## Session End Protocol

1. Update `progress-tracker.md`: completed, in progress, next up, open questions,
   decisions, Known Issues, session notes.
2. Run the Integrity Checklist (`ai-workflow-rules.md` §14) items that apply.
3. Commit and push.

## Time Gates (mirror; the tracker is authoritative)

- P2 cut line: **hour 56** from T+0.
- Feature freeze: about **hour 62**. After it: bug fixes, README, evaluation report, report and video only.
- Submit at least **2 hours** before the deadline. Never in the last hour.
- On-site final day: read the new requirements fully, write a one-line plan for each,
  implement the smallest change that satisfies it, commit step by step, rebuild and re-verify
  the APK, and stop adding features 20 minutes before the second evaluation.