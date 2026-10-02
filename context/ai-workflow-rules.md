# AI Workflow Rules

These are rules, not suggestions. Read this file in full at the start of every session, after the entry file (`CLAUDE.md` or `AGENTS.md`) points you here.

**Priority of rules, highest first:**
1. The official hackathon rulebook and guideline (§1). Breaking these can disqualify the team.
2. The deliverable: a working Android APK built by GitHub Actions, plus a live web URL (§2).
3. The invariants in `architecture.md` §14 and the Project Rules in §3.
4. Everything else (polish, extras).

If two rules conflict, follow the higher one and record the conflict in `progress-tracker.md`.

---

## 1. Hackathon Rules (binding)

Source: AI Hackathon 2026 official guideline and rulebook (DIU CPC x upay).

| Rule | What it means for the agent |
|---|---|
| Ideas and the challenge-specific solution are built inside the **72-hour window** from T+0 (§4.1) | Before T+0 is confirmed, write **no challenge-specific code**. Allowed: empty app skeleton, Capacitor shell, CI, APK pipeline, tooling, fonts and icons. Not allowed: data generator, forecast, planner, cash-out engine, challenge-specific screens or prompts |
| A substantially complete challenge-specific solution prepared early is **not allowed** (§4.3, §9.3) | Never "get ahead" on challenge code. Check the T+0 status in `progress-tracker.md` first. If unconfirmed, treat it as not started |
| **Pre-T+0 hygiene** (conservative reading of 4.1 and 9.3) | Keep the Sathi context files **local and uncommitted** until T+0. Pre-T+0 pushes go only to a neutral, generic scaffold repo. At T+0, commit the context files as the first commits of the window |
| Public GitHub repo, **continuous commit history** in both phases (§5.1-5.3) | Commit every 1-2 hours or after every meaningful step. Never batch a day's work into one commit. Never squash. Never force-push `main`. **Merge branches with a merge commit or fast-forward. Never use GitHub's "Squash and merge".** Every team member commits |
| Initial code pushed by the initial deadline. On-site updates pushed inside the on-site window (§5.5) | Push after every unit. Never leave work only on a local machine |
| Complete `README.md` with **all ten items** (§6.2) | Keep it current. The ten items: overview, features, tech stack, requirements, installation and setup, environment variables (placeholders only), run and build commands, **live deployment URL**, testing instructions, other configuration |
| **Video demo + project report + repo link** by T+72h (§7) | These are P0 deliverables. Submit with at least 2 hours of buffer |
| Two-stage evaluation. New requirements arrive on the final day and must be integrated on site (§8) | Keep layers modular and config-driven. Keep the repo buildable from a fresh clone. Keep the APK pipeline working so an updated APK can be produced quickly on site |
| Disclose significant external datasets, APIs, models, libraries and pre-existing components (§4.4, §9.2) | Record each in `docs/third_party.md` when it is added. **Include the AI coding tools used** |
| Every member must be able to explain the design, implementation and AI components (§4.5, §9.4) | Prefer simple, readable code. Leave short comments explaining why. Never add a technique nobody on the team can explain |
| Copied or misrepresented work means disqualification (§9.1) | Do not paste code you cannot attribute. Use only licensed libraries. Do not copy another product's assets or copy |
| Only synthetic, public or self-generated data (guideline §11, §14) | No real PII, ever. No scraped personal data |
| Responsible AI minimums: privacy, explainability, fairness check, security, human oversight, transparency, no harmful automation (guideline §14) | Each must be visibly addressed in code and docs |
| Track 03 "IMPORTANT": empower the customer, **no manipulative recommendations, hidden fees, or designs that encourage unnecessary spending** | Applies to copy, UI, haptics, motion and recommendations |
| Do not put sensitive decision logic entirely inside a free-form LLM prompt (guideline §12) | See Project Rules 1 and 2 |

Evaluation weights to keep in mind: problem relevance 20%, AI/ML depth 20%, business/customer impact 20%, prototype quality 15%, innovation 10%, scalability 10%, responsible AI 5%. Visual polish has no weight of its own. It only helps through "prototype quality" and "innovation".

---

## 2. Deliverable Definition: the APK

The product is an **installable Android APK**: a Next.js static export wrapped by Capacitor, built by GitHub Actions, calling a deployed HTTPS backend. A **live web URL is also required** by the rulebook.

The deliverable is **done** only when all of these are true:
1. The GitHub Actions APK workflow run is green on `main`.
2. The APK is attached to a **public GitHub Release** (tag `v*`). The submission links the Release, not a workflow artifact (artifacts expire and need a login).
3. It installs on the demo phone (unknown-sources enabled) and opens with **no white screen**.
4. It reaches the live backend over **HTTPS** and loads data.
5. **Airplane mode:** the app opens, shows the bundled demo data with a visible "Demo data, not live" label, and does not crash.
6. The four official journeys work end to end (typed input at minimum).
7. Voice works, or typed input shows a clear message.
8. The APK contains **no secrets**. Only `NEXT_PUBLIC_*` values are baked in.
9. The live web URL works too.
10. A fresh clone can build from the README alone.

**Pipeline rules**
- Prove the pipeline first (Unit 01b): a hello-world APK installed on the phone before building features.
- The API base URL is baked in at build time through the repo **variable** `NEXT_PUBLIC_API_URL` (a variable, not a secret). This exact name is used in the workflow, `.env.example`, README and code. **Deploy the backend before the first real APK.** If the backend URL changes, rebuild the APK.
- The APK is **debug-signed** for the hackathon. Do not add a release keystore.
- The workflow needs `permissions: contents: write` to publish Release assets.
- `package-lock.json` must be committed (CI uses `npm ci`).
- Commit `web/android/` after `npx cap add android`. Mark `gradlew` executable (`git update-index --chmod=+x web/android/gradlew`) and keep it LF through `.gitattributes`, because the team works on Windows.
- Version code comes from the CI run number. Check the exact `build.gradle` format before relying on a `sed` replacement.
- Pin Node, JDK and Capacitor major versions. Match the JDK to what the installed Capacitor Android version requires. Record the pins in `progress-tracker.md`.
- Do not require Android Studio for a build. CI builds the APK.

---

## 3. Project Rules (non-negotiable)

Violating any of these is a failure, even if the code runs. The full invariant list is `architecture.md` §14, the single source of truth. This is the working summary.

1. **The LLM never computes money.** Figures come from `core/` or `ml/` through tool output. The LLM routes intent and narrates only.
2. **No unvalidated LLM text reaches the user.** The numeric validator fails closed to a deterministic Bangla template.
3. **`core/` is pure.** No I/O, network, DB, clock reads, unseeded randomness, or imports from `api/`, `llm/`, `ml/`, `web/`.
4. **Money is integer paisa.** The UI renders the API's `display` strings. It never computes, reformats, animates or interpolates money or probabilities.
5. **Every insight response carries an `evidence` block.** Label every figure: Data, Prediction, Assumption, or Generated text.
6. **Forecasts are ranges plus a probability.**
7. **LLM tools have no `user_id` argument.** The orchestrator injects it from the verified token.
8. **No manipulation, no harmful automation.** No urgency, upsell, guilt copy, alarming haptics, or hidden fees. Sathi never moves money and never approves or denies lending.
9. **Synthetic data only. Never invent upay facts.** Unknown values become named ASSUMPTIONs in `config/` and `docs/assumptions.md`.
10. **No secrets in client code. No server-only Next.js features.** Static export, client-side fetching, only `NEXT_PUBLIC_*` public values.
11. **Design tokens only.** No hardcoded color, radius, spacing, shadow or blur. Every screen must work with effects `off`.
12. **Capacitor plugins are imported only in `web/lib/native/`,** each with a web fallback.
13. **Do not mark a web unit complete without a phone check on the latest APK.**
14. **The app never shows a blank screen.** Backend down, LLM down, or offline: it falls back to labeled demo data or a clear message.

---

## 4. Approach

- Build **Sathi (সাথী)** incrementally using a spec-driven workflow. One spec file in `context/specs/NN-name.md` defines one unit. Implement exactly what the spec says.
- The context files define what to build, how, and where the project stands. Do not infer or invent behavior from scratch.
- `CONTEXT.md` is a historical master reference. **Where it conflicts with a `context/` file, the `context/` file wins.** If two `context/` files conflict, stop and flag it. Do not pick one silently.
- **Walking skeleton first.** Get a thin end-to-end slice (data → API → screen → APK on phone) working early, then deepen. Never leave the UI until the last day.
- A working, deployed, demoable product always beats an unfinished ambitious one. Keep `main` demoable at all times.
- Priorities: **P0** must ship. **P1** ships if P0 is done. **P2** is cut without discussion if the project is behind. Do not start a lower-priority unit while a higher-priority unit is unfinished.
- Visual polish never displaces P0 AI work. The design-system units (19a, 19b) are time-boxed to about 4 hours together.

---

## 5. Open Design Decision (blocking for UI units)

The theme is **not settled**:
- `ui-context.md` currently specifies **light-only** liquid glass.
- The team's Origin reference describes a **dark-mode-first** iOS look.

**Rule:** do not start Unit 19a (tokens and glass system) until the decision is recorded in `progress-tracker.md` and `ui-context.md` is updated to match. The agent must not choose a theme itself. If a UI task arrives before the decision, stop and ask.

**Recommendation for the humans (not a decision):** dark-first. It matches the Origin brief, reduces glare on low-end OLED phones, and makes text-over-glass contrast easier to control. Whichever is chosen, delete this section once recorded.

These stay fixed regardless of the theme: tokens only, glass on floating chrome only, effects levels `full / reduced / off`, no UI-interpolated numbers, Lucide icons (no SF Symbols on Android), Android font scale respected, a contrast check on text over glass, and caution states never conveyed by color alone.

---

## 6. Scoping Rules

- Work on **one feature unit at a time**.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.
- Do not add dependencies before the unit that first needs them. Record each new dependency in `docs/third_party.md`.
- Do not refactor, rename, or "improve" code outside the current unit's scope.
- Do not add features, endpoints, screens, or config options that the spec does not list.
- Do not delete or overwrite earlier decisions without recording the change in `progress-tracker.md`.
- Never "fix" a failing test by weakening it, deleting it, or skipping it, unless the spec is wrong. In that case change the spec first.

### System boundaries (one unit, one boundary)

| Boundary | Folder | Owns |
|---|---|---|
| Configuration | `config/` | Tunable values and assumptions (YAML). No code |
| Data generation | `data_gen/` | Persona simulators, injected patterns, seeds |
| Business logic | `core/` | Metrics, categorizer, planner, cash-out logic, money, formatting, amount parsing (pure) |
| ML | `ml/` | Features, training, evaluation, artifacts, inference wrappers |
| API | `api/` | FastAPI routers, schemas, services, repositories, auth |
| LLM layer | `llm/` | Tools, prompts, templates, validator, sanitizer, provider adapters |
| Frontend | `web/` | Next.js static UI, tokens, glass, motion, evidence rendering, offline demo bundle |
| Native bridge | `web/lib/native/` | The only place Capacitor plugins are imported |
| Android shell | `web/android/` | Generated Capacitor project (protected) |
| CI | `.github/workflows/` | Lint, test, deploy, APK build, Release |
| Tests | `tests/` | Unit, property, evaluation, security |
| Docs | `docs/` | Assumptions, risks, model card, data contract, eval report, third_party, perf |

### When to split work

Split an implementation step if it combines:
- Changes in more than one boundary from the table above
- Model training or evaluation together with product features that depend on the result
- New LLM prompts or tools together with the engine logic they call
- Design tokens or glass-system work together with feature screens
- Native plugin wrappers together with the screens that use them
- Backend changes together with APK pipeline changes
- Behavior that is not clearly defined in the context files or the spec
- Multiple unrelated API routes

Order inside a feature: data and contract → pure logic in `core/` with tests → ML with baseline and evaluation → API route → LLM tool and validator → UI → phone check.

If a change cannot be verified end to end quickly, the scope is too broad. Split it.

---

## 7. Handling Missing Requirements

- Do not invent product behavior not defined in the context files.
- If a requirement is ambiguous, resolve it in the relevant context file before implementing.
- If a requirement is missing, add it as an open question in `progress-tracker.md` before continuing.
- If a financial rule is undefined (fee rate, salary-day rule, essentials threshold), do not guess silently. Create a named, configurable assumption in `docs/assumptions.md` with a source note and a default, reference it from config, and never hardcode it.
- If the official hackathon documents are silent, treat it as an open question for the organizers, not as a fact.
- If the T+0 brief differs from the earlier track guideline, **the T+0 brief wins.** Stop, flag the difference, and update the context files before coding.
- Ask **one precise question** at a time, with at most two options and a recommendation. Record the answer in `progress-tracker.md`.

---

## 8. Failure and Debugging Protocol

Assume things will break. This section is how a breakage stays a small delay instead of a missed deadline.

### 8.1 Bug triage loop
1. **Reproduce** it. Write down the exact steps, build, device and data.
2. **Minimize** it to the smallest failing case. Prefer a failing test.
3. **Read the first actual error** (logs, CI output, `adb logcat`, browser console), not the last. Build tools cascade, and the first error is the cause.
4. Form **one hypothesis**, change **one thing**, re-run.
5. After a fix, add a regression test (or a documented manual check for device-only issues) and log it in the Fix Log in `progress-tracker.md` (symptom, root cause, fix).
6. **Three-attempt rule:** after three failed attempts on the same problem, stop. Write down what was tried and the minimal reproduction, record it under **Known Issues** in `progress-tracker.md`, and ask for a decision (revert, workaround, or cut). Do not keep trying random fixes.
7. **Time-box:** a P0 bug that has eaten 90 minutes gets escalated. Choose: simplify, use the fallback, or cut the feature.
8. **Never upgrade or downgrade** Capacitor, Gradle, AGP, JDK, Node or Next "to see if it helps". Pinned versions change only when the cause is proven.

### 8.2 Never do this while debugging
- Never disable validation, auth, scoping, or the numeric validator to "make it work".
- Never hardcode a demo value to hide a failing engine.
- Never commit secrets, tokens, or `.env` to get past a deploy problem.
- Never force-push or rewrite `main` history.
- Never ship a feature that works only with the LLM provider online.

### 8.3 Known failure modes and first checks

| Symptom | Likely cause | First check |
|---|---|---|
| `next build` export fails | API route, middleware, server action, dynamic route without `generateStaticParams`, or `next/image` optimization | Remove the server-only feature. Set `images.unoptimized: true`. Use query params instead of dynamic routes |
| APK opens to a white screen | Wrong `webDir`, missing `out/`, `cap sync` skipped, or a JS error on load | Confirm `output: "export"` and `webDir: "out"`. Run `npm run build`, then `npx cap sync android`. Inspect with Chrome `chrome://inspect` or `adb logcat` |
| API works in browser, fails in APK | CORS missing the Capacitor origin, `http` blocked by Android, or wrong base URL | Use `https` only. Allow origin `https://localhost` (with `androidScheme: 'https'`) in CORS. Show the baked-in base URL on a debug screen |
| First request hangs 30+ seconds | Free-tier backend asleep | Ping `/healthz` at app start. Show the waking-up state, then fall back to demo data after the timeout |
| Old data or old URL in APK | APK built before the backend URL or contract changed | Rebuild the APK. Confirm the `NEXT_PUBLIC_API_URL` repo variable |
| CI fails at `npm ci` | `package-lock.json` missing or out of sync | Commit the lockfile generated by the same Node major |
| Gradle "permission denied" on `gradlew` | Lost exec bit on Windows | `git update-index --chmod=+x web/android/gradlew`. The workflow also runs `chmod +x` |
| Gradle or Java version error | JDK does not match Capacitor's Android requirement | Align `setup-java` with the Capacitor docs for the installed version |
| `versionCode` replacement did nothing | `build.gradle` format differs | Open the file and fix the pattern. Verify in CI logs |
| Release has no APK | Workflow lacks `contents: write`, or the tag does not match `v*` | Check workflow permissions and the tag name |
| APK will not install | Unknown-sources off, or a conflicting older install | Enable install from this source. Uninstall the old build |
| Play Protect warns on install | Normal for a debug-signed APK | Tap "Install anyway". Document it in the README |
| Plugin import crashes web build | Plugin imported outside `web/lib/native/` or no web fallback | Move it behind the wrapper with a fallback |
| Plugin works on web, fails on device (or the reverse) | Capacitor major mismatch between core and plugin, or permission missing | Align plugin majors with core. Check the manifest permission and sync |
| Layout clipped under status or navigation bar | Safe-area insets missing | Apply `env(safe-area-inset-*)`. Check edge-to-edge behavior on the device |
| Chat composer hidden behind keyboard | Keyboard resize mode | Verify keyboard plugin and resize configuration on the phone |
| Janky scrolling or battery drain | Too much blur or an animated blur | Drop to `reduced` or `off`. Never animate `backdrop-filter`. Max two blur layers |
| Bangla text clipped | Line height too tight or fixed-height containers | Check line heights, use `rem`, test at 200% font scale |
| Bangla voice returns nothing | Language pack or Google speech service missing, no internet, permission denied | Test on the demo phone early. Typed fallback is the plan, not an afterthought |
| Voice mishears an amount | Speech errors on numbers | Editable transcript, deterministic parser, and a "Did you mean ৳৩০,০০০?" confirmation |
| Validator rejects a correct answer | Digit, comma or `৳` formatting mismatch | Test Bengali digit normalization. Fix the shared formatter. Never loosen the validator without a test |
| LLM provider down, rate-limited or over budget | Quota, outage, spend cap hit | The template fallback must carry the whole flow. Check the kill switch |
| API key leaked (repo, logs, bundle) | Committed `.env`, or a key read client-side | Revoke and rotate immediately, then remove it from the code. Check the built `out/` bundle with a grep for key prefixes |
| Same seed gives different data | Unseeded RNG, unordered iteration, library version drift | One `numpy` Generator passed explicitly. Sort before sampling. Pin versions |
| Wrong "end of month" or salary-day results | Naive datetimes or UTC/Asia/Dhaka confusion | Timezone-aware datetimes only. Test month boundaries |
| Money off by a paisa | Float arithmetic or scattered rounding | Integer paisa. One rounding function |
| Forecast looks great, then collapses | Data leakage, or the model merely reads the generator's pattern | Check the split by user and time. Run the noise-robustness test. Report honestly |
| Deployed backend loses data after redeploy | Ephemeral disk with SQLite | Documented limitation for demo data. Seed data is rebuilt on start |
| Deploy succeeds but `/healthz` shows an old version | Stale deploy | Compare the commit hash from `/healthz` with `main` |
| Merge breaks `main` | Merged before the checklist passed | Revert the merge first, fix on the branch |
| Judges cannot run the project | README missing a step or env var | Follow the README on a clean clone and time it |

### 8.4 Fallbacks that must exist before demo
- **LLM down:** deterministic Bangla template answers cover all four journeys.
- **Backend asleep or down, or phone offline:** bundled demo data for every persona, shown with the "Demo data, not live" label. Plus a one-command local run path and a recorded video.
- **Voice fails:** typed input, with clear messaging.
- **Glass too slow:** effects level `off` is fully usable.
- **Network at the venue fails:** local backend plus a debug APK pointing to it, or the offline demo bundle, or the recorded video. Prepare this before the on-site day.
- **Feature unfinished at cut time:** hide it behind a config flag. Do not ship half-working screens.

### 8.5 Known Issues log
`progress-tracker.md` has a **Known Issues** section. Every unresolved bug goes there with: ID, symptom, steps to reproduce, attempts made, owner, severity (blocks P0 / blocks demo / cosmetic), and decision (fix, workaround, cut). Review it at every session start.

---

## 9. Handling Time Pressure

Hour gates are measured from T+0. **The authoritative numbers live in `progress-tracker.md`; if they differ from this section, the tracker wins.** Current mirror:

- **P2 cut line: hour 56.** Cut any unfinished P2 unit without discussion.
- **Feature freeze: about hour 62.** After it: bug fixes, README, evaluation report, report and video only.
- **Submit at least 2 hours before the deadline.** Never submit in the last hour.

Rules:
- If a P0 unit slips, drop P2 units immediately and tell the team.
- 72 hours is not 72 working hours. Plan for roughly 35 to 45 productive hours per person.
- Never leave `main` in a broken or undeployable state. Work on a feature branch and merge only when the unit's checklist passes. If the APK workflow is red, fixing it is the next task, ahead of new features.
- If glass or motion work overruns its time box, fall back to `reduced` defaults and move on.
- **Final-day on-site phase:** read the new requirements fully, write a one-line plan per requirement, implement the smallest change that satisfies each, commit step by step, rebuild and re-verify the APK, and stop adding features 20 minutes before the second evaluation to rehearse the demo. Do not start risky changes in the last 30 minutes of the build window.

---

## 10. Data and ML Rules

- All data generation is **seeded and reproducible**. The same seed gives identical output.
- Document every synthetic assumption in `docs/assumptions.md` when it is made, not later.
- Split by **user and by time**. The held-out test set is never used for training, tuning, or threshold selection. Tune on a separate validation set.
- Every model is compared against a **naive baseline**, reported side by side.
- Report calibration for quantile forecasts (p10 to p90 coverage), not only point error.
- Report results **per persona and income band**.
- Metrics that measure whether a detector finds a pattern that the generator injected are **sanity checks, not accuracy claims**. Label them that way.
- Back-test the goal planner on held-out history: does the stated `P(goal met)` match how often goals were actually met?
- State in every metric report that results are on synthetic data and real validation needs governed data.
- Keep business rules separate from ML predictions. Thresholds live in `config/` or `core/`.
- Version every trained model artifact and reference the version in the `evidence` block.
- Training runs offline only, never in a request handler.

---

## 11. LLM Layer Rules

- Define tools with typed arguments. Do not pass free-form strings into engines.
- Scope every tool call to the authenticated user. A tool must never accept a user ID from the model.
- Sanitize all user-supplied and counterparty text before it enters a prompt. Treat transaction text as untrusted: pass it only inside a delimited data block, never as instructions.
- Do not send PII to any provider.
- Do not place sensitive decision logic, thresholds or fee rules inside a prompt.
- Keep prompts in `llm/prompts/` as versioned templates.
- Core Bangla insight wording comes from reviewed templates. The LLM may paraphrase within validator constraints and may not add facts.
- Parse spoken or typed amounts ("৩০ হাজার", "30k") with a **deterministic parser in `core/`**, never the LLM, and confirm the amount with the user before using it.
- Out-of-scope requests (loans, investment advice, anything that moves money) get a fixed refusal template with a gentle redirect. These have tests.
- Provide a deterministic fallback for every LLM-backed answer. The four official journeys must work through starter chips with **no LLM at all**.
- Enforce a per-token rate limit and a **daily spend cap with a kill switch** that falls back to templates. The APK makes the API public.
- Maintain a Bangla test prompt set and a prompt-injection test set. Run both before closing any unit that touches `llm/`.

---

## 12. UI and APK Rules

- Follow `ui-context.md` for all visual decisions. Never invent a visual decision. If the file is silent, ask.
- Static export only. All user data is fetched on the client through the typed API client. No Next.js API routes, server actions, middleware or dynamic routes.
- Plugins (haptics, speech, status bar, keyboard, back button, splash) live only in `web/lib/native/`, each with a typed interface and a web fallback.
- Handle the Android back button (close the topmost sheet first, exit only from the root tab), safe-area insets, status bar style and keyboard resize.
- Every data view has all required states: loading, waking up, offline, empty, error, success.
- Never animate or interpolate money, probabilities or any API figure. Numbers appear by fade only.
- Glass only on floating chrome through the shared classes. No ad hoc `backdrop-filter`.
- Fonts are bundled in the app. Do not load them from a CDN.
- Icons are Lucide. Do not use SF Symbols, Apple fonts or any other product's assets.
- Check each UI unit on the **real demo phone** with the latest CI APK, at effects `full`, `reduced` and `off`, and keep screenshots.
- Record performance observations in `docs/perf.md`.
- Regenerate the offline demo bundle whenever the tool-output schema changes.

---

## 13. Protected Files

Do not modify the following unless explicitly instructed:

- `web/components/ui/*` and any generated UI library components
- Third-party library internals and `node_modules/`
- Lockfiles, except through the package manager
- `web/android/` and generated Capacitor config (except in the APK unit)
- The frozen held-out test set and its seed configuration
- Trained model artifacts (regenerate through the training pipeline)
- `.env` files and anything containing secrets
- `context/*.md`, except `progress-tracker.md`, which you update
- `docs/data_contract.md` and the API schema, unless the unit is a contract-change unit (update affected specs and tests in the same step)
- `.github/workflows/android-apk.yml` outside the APK or CI units

---

## 14. Hackathon Integrity Checklist (run at every session end and before submission)

- [ ] No challenge-specific code existed before T+0 was confirmed
- [ ] Commits are small, frequent and meaningful across the whole period, from every member, with no squash-merges
- [ ] Repo is public, no secrets, no real PII, `.env.example` has placeholders only
- [ ] `docs/third_party.md` lists every significant external model, API, dataset, library, pre-existing component and AI coding tool
- [ ] README has all ten items and a working live URL
- [ ] Video and project report are ready
- [ ] The APK link is a public GitHub Release and works without a login
- [ ] Airplane-mode test passed on the phone
- [ ] Every team member can explain the architecture, the forecast, the planner, the validator and the LLM layer
- [ ] On-site phase: updates committed step by step within the allotted time

---

## 15. Keeping Docs in Sync

Update the relevant file whenever implementation changes:

- System architecture or boundaries: `architecture.md`
- Storage model: `architecture.md`
- Code conventions: `code-standards.md`
- Feature scope: `project-overview.md`
- Visual tokens or component conventions: `ui-context.md`
- Assumptions, fee rates, thresholds: `docs/assumptions.md`
- Risks and mitigations: `docs/risks.md`
- Model behavior, limits, metrics: `docs/model_card.md`, `docs/eval_report.md`
- Data tables or API shapes: `docs/data_contract.md`
- External components: `docs/third_party.md`
- Device performance: `docs/perf.md`
- Setup, env vars, run commands, APK link: `README.md`
- Commands: the Commands block in `CLAUDE.md`

If implementation changes the architecture, scope or standards, update the file **before** continuing.

---

## 16. Session Start and End

**At the start of every session:**
1. Read the entry file, then the context files in the order it lists.
2. Read `progress-tracker.md`. State the current phase, current goal, next unit, the T+0 status, and the open **Known Issues**.
3. Confirm the spec you will implement. If there is none, stop and ask for one.

**At the end of every session:**
1. Update `progress-tracker.md` (completed, in progress, next up, open questions, decisions, known issues, session notes).
2. Run the Integrity Checklist (§14) items that apply.
3. Commit and push.

---

## 17. Prompt Cycle

- **Implement:** read the spec, mark the unit in progress in `progress-tracker.md`, implement exactly as specified, stay within scope.
- **Correct:** when something does not match the spec, fix only that element and change nothing else.
- **Close:** verify against the checklist in §18, mark the unit complete in `progress-tracker.md`, and push the branch `feat/NN-feature-name`. Merge to `main` with a merge commit or fast-forward only.

---

## 18. Before Moving to the Next Unit

1. The unit works end to end within its defined scope.
2. No invariant in `architecture.md` and none of the Project Rules (§3) was violated.
3. `progress-tracker.md` reflects the completed work and any Known Issues.
4. Backend: `pytest` is green, and lint and type checks pass.
5. Frontend (if `web/` changed): `npm run build` passes with no TypeScript or console errors, the static export in `web/out` exists, and `npx cap sync android` runs clean.
6. Every new or changed number shown to the user traces back to a tool output with an `evidence` block.
7. If `core/` changed: unit tests with hand-calculated expected values are added.
8. If `ml/` changed: baseline comparison, calibration and per-persona results are updated.
9. If `llm/` changed: the Bangla test set, the numeric-consistency validator test, the out-of-scope refusal tests and the prompt-injection tests pass.
10. If `web/` changed: the latest CI APK was installed on the demo phone and the relevant journey was run.
11. If the UI changed: screenshots at `full`, `reduced` and `off` are kept, and contrast was checked including text on glass.
12. No hardcoded color, radius, spacing, shadow or blur values were added.
13. The deployed backend and web URL still work (smoke test), and `/healthz` shows the expected commit.
14. New assumptions are in `docs/assumptions.md`, new external components are in `docs/third_party.md`.
15. The change is committed with a Conventional Commit message and pushed. `main` is still deployable.