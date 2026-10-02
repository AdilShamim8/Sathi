# Sathi (সাথী) 🇧🇩

> **A Bangla-First AI Financial Copilot for Mobile-Wallet Users**  
> Built for **AI Hackathon 2026**, Track 03: *Customer Innovation & Financial Independence*  
> Organized by **DIU Computer and Programming Club (DIU-CPC)** × **উপায় (upay)**, Daffodil International University.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-brightgreen.svg)]()
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-Next.js%20(Static%20Export)-black.svg)]()
[![Shell](https://img.shields.io/badge/Mobile-Capacitor%20Android-blueviolet.svg)]()

---

## 1. Project Overview

Many low- and irregular-income mobile financial service (MFS) users have access to digital payments but lack financial control. Income arrives at one time while household obligations arrive at another; users discover shortfalls only in the last week of the month, forcing them into informal borrowing or skipping essentials. In addition, habitual small cash-outs lead to significant fee leakage while taking money off the digital trail.

**Sathi (সাথী)** turns transaction history into four actionable tools:
1. **Plain Bangla Explanations:** Explains cash-flow trends, spending velocity, and balance movements in natural, accessible Bangla.
2. **Shortfall Forecasting:** Quantile regression forecasts liquidity pressure before the next income arrives, providing calibrated probability ranges rather than misleading point estimates.
3. **Feasible Goal Planning:** Generates realistic savings paths with calibrated success probabilities using Monte Carlo simulations.
4. **Cash-Out Conversion Audit:** Identifies recurring cash-outs that could plausibly remain digital and quantifies potential fee savings.

### The Track 03 Big Question
> *"How might an MFS platform help customers become more financially confident and independent, not merely more active users?"*

Sathi's answer: **Empower the customer with foresight, clear trade-offs, and honest options, keeping all financial decisions strictly in human hands.** Sathi never moves money, never determines credit underwriting, and never nudges spending.

---

## 2. Key Features & AI Advantage

| Capability | How AI & Engineering Are Applied | Why a Simple Rule Is Insufficient |
| :--- | :--- | :--- |
| **Shortfall Forecasting** | LightGBM quantile regression ($p_{10}, p_{50}, p_{90}$) on residual cash flow + bootstrap path sampling | Fixed rules fail under lumpy income dates and volatile expenses; calibrated probability reflects true risk. |
| **Goal Feasibility** | Monte Carlo simulation over historical inflow/outflow distributions | Simple "save 20%" rules ignore irregular timing and overestimate feasibility, leading to abandoned goals. |
| **Bangla Copilot** | LLM orchestrator for intent routing and natural narration with a strict numeric validator | Translates complex figures into culturally native Bangla while strictly enforcing deterministic math. |
| **Cash-Out Insights** | Deterministic transaction cluster analysis mapping recurring cash withdrawals to digital merchant rails | Accurately calculates true fee savings and digital retention potential. |

---

## 3. System Architecture & Tech Stack

```
        OFFLINE (Developers / CI)
 data_gen/ ─► Seeded Dataset ─► ml/ (Features → Train → Evaluate) ─► Versioned Model Artifacts
     │
     └─► Demo Bundler ─► web/public/demo/*.json (API-shaped, synthetic demo bundle)
                                                                          │
        ONLINE (Request Flow)                                             ▼
 Android APK (Capacitor) ──┐                                       ml/ Inference
 Web App (Static Export) ──┼──HTTPS──► api/ (FastAPI) ──► core/ (Pure Deterministic Engine)
        │                  │              │
        │ Backend Offline  │              └──► llm/ (Sanitizer → Tools → Validator → Template Fallback)
        └─► Bundled Demo   └───────── Evidence-Bearing JSON Responses
            Data (Labeled)
```

### Technology Stack
- **Backend:** Python 3.11+, FastAPI, Pydantic v2 (strict schemas, OpenAPI docs)
- **Data & ML:** pandas, NumPy, LightGBM (quantile loss), scikit-learn
- **Storage:** SQLite (WAL mode)
- **Frontend:** Next.js (Static Export `output: "export"`), React, TypeScript (strict mode)
- **Styling & UI:** Tailwind CSS, shadcn/ui (Radix), Lucide Icons, Dark-First theme
- **Typography:** Noto Sans Bengali & Hind Siliguri (locally bundled, offline-safe)
- **Native Android Shell:** Capacitor (cross-platform native runtime)
- **CI/CD:** GitHub Actions (linting, automated testing, debug-signed APK compilation, GitHub Releases)

---

## 4. Architectural Invariants (Non-Negotiables)

1. **LLM Never Computes Money:** The LLM only routes user intent and narrates engine results. All math is deterministic.
2. **Numeric Validator Fails Closed:** Every number emitted by the LLM is validated against engine outputs; unverified figures fail closed to a deterministic Bangla template.
3. **Pure Core:** `core/` contains pure business logic with zero I/O, no database access, no network calls, and no clock reads.
4. **Integer Paisa:** Money is strictly integer paisa (`paisa`) throughout backend, database, and client types.
5. **Display Strings Only:** The frontend renders read-only `display` strings generated by the server and never performs money arithmetic.
6. **Evidence Blocks:** All user insights include an `evidence` block with labeled figures (`Data`, `Prediction`, `Assumption`, `Generated`).
7. **Offline Demo Resilience:** The mobile APK includes an offline demo data bundle with 5 distinct personas and never presents a blank screen.

---

## 5. Personas

Sathi is validated across 5 synthetic personas:
1. **Rina (Hero Persona):** Salaried garment worker with fixed monthly salary on the 7th, front-loaded obligations, and month-end liquidity squeeze.
2. **Remittance Household:** Irregular, lumpy inflows from overseas family members.
3. **Gig / Ride-Share Driver:** Daily volatile income with high-frequency fuel and maintenance outlays.
4. **Student:** Sporadic small family allowances with limited transaction history.
5. **Small Merchant / Shopkeeper:** Mixed personal and micro-business transactions with heavy cash dependency.

---

## 6. Repository Layout & Documentation Map

```
├── CLAUDE.md                    # Agent entry file & operational protocols
├── AGENTS.md                    # Multi-agent interoperability instructions
├── CONTEXT.md                   # Comprehensive master reference & domain models
├── README.md                    # Project overview & quickstart
├── LICENSE                      # Apache 2.0 Open Source License
├── Hackathon Rule Context/      # Official DIU CPC x upay hackathon documents
│   ├── ai_dev_fest_2026_ai_hackathon_rulebook.md
│   └── ai_hackathon_2026_student_project_guideline.md
└── context/                     # Architectural specifications & working guides
    ├── project-overview.md      # Product scope, problem statement, personas
    ├── architecture.md          # System architecture, boundaries, invariants
    ├── code-standards.md        # Python/TypeScript coding rules & conventions
    ├── ui-context.md            # Dark-first design system & Bangla typography
    ├── ai-workflow-rules.md     # Development workflow & integrity checklists
    └── progress-tracker.md      # Hour gates (T+0 to T+72h), units roadmap
```

---

## 7. Requirements & Prerequisites

- **Python:** 3.11 or higher
- **Node.js:** v18 LTS or v20 LTS (with `npm` 9+)
- **Android SDK:** (Optional, for local APK builds; GitHub Actions handles CI builds)
- **Operating System:** Windows, macOS, or Linux

---

## 8. Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/AdilShamim8/Sathi.git
cd Sathi
```

### 2. Backend Setup
```bash
# Create and activate a virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd web
npm install
```

---

## 9. Environment Variables

Create `.env` in the root directory (refer to `.env.example`):

```ini
# Backend API Configuration
ENVIRONMENT=development
PORT=8000
API_V1_PREFIX=/v1

# LLM Provider Configuration (Server-side only)
LLM_PROVIDER=gemini
LLM_API_KEY=your_api_key_here
LLM_MODEL=gemini-1.5-flash

# Frontend Configuration (Baked at build-time)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Security Note:** Secrets and server keys are never committed to git or exposed to the client bundle. Only `NEXT_PUBLIC_*` variables are bundled into static frontend assets.

---

## 10. Run and Build Commands

| Target | Command | Purpose |
| :--- | :--- | :--- |
| **Backend Dev Server** | `uvicorn api.main:app --reload --port 8000` | Start FastAPI local server |
| **Frontend Dev Server** | `cd web && npm run dev` | Start Next.js local dev environment |
| **Frontend Static Export** | `cd web && npm run build` | Generates static HTML/JS/CSS in `web/out/` |
| **Capacitor Android Sync** | `cd web && npx cap sync android` | Sync static export into Android project |
| **Android APK Build** | Triggered via GitHub Actions (`.github/workflows/android-apk.yml`) | Produces public debug-signed APK |

---

## 11. Testing & Code Quality

```bash
# Run backend test suite
pytest

# Property-based testing with hypothesis
pytest tests/test_money_properties.py

# Linting & static analysis
ruff check .
mypy core api llm

# Frontend linting & unit tests
cd web
npm run lint
npm run test
```

---

## 12. Deliverables & Hackathon Roadmap

- **Live Web URL:** Coming soon upon deployment
- **Android APK:** Built automatically by GitHub Actions and published as a public [GitHub Release](https://github.com/AdilShamim8/Sathi/releases)
- **Submission Milestone:** Target submission at T+66h with video demonstration and technical project report

---

## 13. License & Attribution

- **License:** Apache License 2.0 — see [LICENSE](LICENSE) for details.
- **Academic & Competition Context:** Developed for AI DEV FEST 2026 AI Hackathon by DIU-CPC and upay.
- **Third-Party Libraries & AI Disclosures:** Documented in `docs/third_party.md` per Hackathon Rulebook §4.4.