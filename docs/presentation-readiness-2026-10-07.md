# Sathi: final ten-minute presentation checklist

Prepared on 7 October 2026 after reviewing the context pack, official rulebook,
Track 03 guideline, current implementation and evaluation report.

## Spend the remaining time on this

| Minutes | Action | Pass condition |
|---|---|---|
| 0–2 | Open the published app and complete **Explore with demo data** onboarding. Warm the app on the presentation phone. | Dashboard, spending, forecast and goals load using clearly synthetic data. |
| 2–4 | Rehearse one journey: explain spending → inspect forecast → create/edit a goal → compare a what-if budget → show evidence. | Each step produces a visible, explainable result. |
| 4–5 | Check Copilot. If Groq still rejects its model, demonstrate the built-in answer and explain the fallback. | A useful answer appears; generated text is never falsely claimed. |
| 5–6 | Install/open the latest available APK. Test back button, keyboard, Bangla and airplane mode. | Online works; offline behavior and demo labeling are visible. |
| 6–7 | Check public repo, live URL, downloadable APK, submitted video and project report. | Judges can open each link without your login. |
| 7–10 | Rehearse the story and divide technical questions between team members. | Everyone can explain the system and the assigned on-site changes. |

Do not start new features, retrain models, change dependencies or redesign
authentication in this window. Fix a blocking, reproducible issue only if it can
be verified before judging. Prepare a local copy of the demo video and screenshots.

## What the judges reward

The guideline's suggested weights are: problem relevance 20%, AI/ML depth 20%,
customer/business impact 20%, prototype quality 15%, innovation 10%, integration
and scalability 10%, responsible AI/security 5%. The organizers' announced
final-day requirements and marking scheme take precedence.

Lead with Rina's cash-flow problem, show the useful decision, then explain the
method and evidence. Demonstrate any newly assigned on-site requirement and
point to its changes in Git history. Both evaluations count toward the result.

## Explain the actual system

- The published product is a Next.js server application. The Android shell
  loads the hosted app and carries an offline core. The Python code is the
  reference service and offline training/evaluation pipeline.
- Rules calculate amounts, categories, commitments and baseline budgets.
  Forecasting and simulation estimate uncertain future outcomes.
- The v1 persona endpoints serve the versioned LightGBM quantile forecaster.
  The primary owner UI uses a separate rule/forecast/logistic-risk pipeline.
  Do not attach the LightGBM benchmark to every dashboard figure.
- Optional online AI explains computed evidence. Numeric checks, and the v1
  slot protocol, reject invalid drafts. Provider errors preserve built-in text.
  Numeric matching is a guardrail; it does not prove every statement is correct.
- Data is synthetic. Sathi neither transfers money nor makes lending decisions.

## Two defensible ML facts

These are results reported in `docs/eval_report.md`, not independently rerun
training results and not results measured on real customers.

1. On the synthetic frozen test, the LightGBM shortfall method has Brier error
   **0.0240**, versus **0.0529** for the simple rule; lower is better. The bootstrap
   baseline is slightly better at **0.0236**, so the model does not win every test.
2. The reported p10–p90 forecast interval covers **84.7%** of daily synthetic
   outcomes, versus its nominal 80% target. A range communicates uncertainty.

Explain the caveats: only 3.1% of test user-weeks have shortfalls; results vary by
persona; the event-recall target was not achieved. Goal-calibration provenance
needs further audit, so avoid presenting its improvement as independently proven.

## What value would a pilot measure?

Measure shortfall incidents, savings-goal completion, avoidable fees, financial
confidence and whether users understand explanations. Compare outcomes against
a control group on governed data. These are proposed pilot outcomes, not proven
impact or revenue. Guard against increased unnecessary spending. Fewer cash-outs
can also reduce fee revenue; digital adoption/retention offsets are hypotheses.

## Likely questions and concise answers

| Question | Answer |
|---|---|
| Why not a fixed savings rule? | Income dates and expenses vary. We estimate timing and uncertainty and show alternatives. The benchmarks show where that helps and where a simpler baseline remains competitive. |
| What is AI here? | Quantile forecasting estimates a distribution; simulations turn it into risk and planning estimates. Optional language models explain verified evidence. Categorization is rules, not a trained classifier. |
| How do you stop hallucinations? | Financial figures are computed outside the LLM. Numeric/slot validation rejects invalid drafts and falls back. We do not claim perfect semantic validation. |
| Is this connected to upay? | No live integration. It is a synthetic Track 03 prototype with an integration path. |
| What happens without internet? | The Android package contains an offline core. Demonstrate its actual behavior on the phone; online LightGBM and provider chat are not claimed offline. |
| Is it ready for real customers? | No. Authenticated ownership, durable storage, security review and governed-data validation come first. |
| What did you change on site? | Explain the actual assigned requirement and its tested before/after behavior. Recent commits fixed financial workflow regressions and added provider configuration/failure diagnostics. |

## Current evidence and gaps

- Verified locally: 120 web tests, ESLint, TypeScript, standalone production
  build and synthetic API smoke checks. Earlier Python verification: 90 tests.
- Main contains the two reviewed changes (`b02a864`, merged chat provider work).
- Live configuration reports Groq / `llama-3.3-70b-versatile`, but the last
  generation probe returned `model_unavailable` and a valid built-in fallback.
  Configuration “ready” only means a key is present, not that generation works.
- The live boot check still reports `needsOnboarding: true`.
- The public `v6.3.0` APK asset was verified with HTTP 200 (2,910,405 bytes):
  https://github.com/AdilShamim8/Sathi/releases/download/v6.3.0/sathi-v6.3.0.apk.
  Current CI-run status could not be verified because GitHub API access was blocked.
- Physical-phone checks and submitted video/report availability remain unverified.
- Owner routes share an unauthenticated owner; hosted `/tmp` SQLite is ephemeral.
  Use synthetic demo data and describe these as prototype limits.

## Context discrepancies to acknowledge

The tracker still says pre-T+0/planning, older architecture describes a static
export with FastAPI, and theme/signing guidance conflicts with the implemented
app. New dated notes describe some changes, but the old decisions remain.
Record actual organizer timing and reconcile these documents after the demo;
never fabricate dates, authorship, device checks or compliance evidence.
The disclosure file now records Codex and the new optional providers. Keep
continuous Git history and disclose significant external components when asked.

Sources: `context/AGENTS.md`, `context/context/`, `context/CONTEXT.md`, official
rulebook §4–9 and project guideline §5, §13–15 under `context/Hackathon Rule Context/`,
`docs/eval_report.md`, and `docs/review-2026-10-07.md`.
