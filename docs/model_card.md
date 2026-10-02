# Sathi Model Card: Quantile Cash-Flow Forecaster

## 1. Model Details
- **Architecture:** Quantile Gradient Boosted Trees (LightGBM)
- **Objective:** Pinball Loss at quantiles $\tau \in \{0.10, 0.50, 0.90\}$
- **Version:** `fc-2026-09-30-26761078`
- **Trained Artifacts:** `ml/artifacts/forecast/fc-2026-09-30-26761078/` (`model_q10.txt`, `model_q50.txt`, `model_q90.txt`)
- **Origin Date:** `2026-09-30`

---

## 2. Intended Use & Invariants
- **Primary Use:** Predict daily net cash flow ranges over a short-term horizon (14–30 days) to alert users to potential liquidity pressure before month-end.
- **Purely Informational:** Sathi **never** automates funds movement, never approves or denies credit, and never nudges spending.
- **Explainability:** All forecast outputs provide empirical ranges (p10 to p90) rather than point predictions.

---

## 3. Training & Evaluation Metrics
Benchmarked on held-out synthetic test partitions across 1,200 evaluation weeks (`docs/metrics/eval.json`):

| Metric | Sathi LightGBM | Naive Baseline | Seasonal Baseline | Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **WAPE (Overall)** | **0.9756** | 1.1072 | 1.2372 | **+11.88%** |
| **Coverage ($p_{10} - p_{90}$)** | **92.17%** | — | — | Well-calibrated ($\ge 80\%$) |

### Fairness Across Synthetic Personas
| Persona | WAPE (Model) | WAPE (Naive) | Test Weeks |
| :--- | :--- | :--- | :--- |
| **Garment Worker** (Rina) | **0.9622** | 1.1711 | 380 |
| **Gig Driver** (Tariq) | **1.0509** | 1.0254 | 190 |
| **Remittance Household** (Jamila) | **0.9207** | 1.0842 | 200 |
| **Shopkeeper** (Rafiq) | **1.0605** | 1.0566 | 210 |
| **Student** (Anik) | **0.8678** | 1.2091 | 220 |

---

## 4. Ethical Safeguards & Responsible AI
- **Fail-Closed Numeric Validator:** LLM text generation is constrained by `llm/validator.py`. Any number not grounded in model output causes immediate fallback to reviewed Bangla templates.
- **Privacy by Design:** Zero production customer PII was ingested; all training was conducted on deterministic synthetic data generated from `data_gen.generate`.
