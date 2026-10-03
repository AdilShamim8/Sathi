# Third-Party Components & AI Tool Disclosure

*Mandatory disclosure in compliance with AI DEV FEST 2026 Rulebook §4.4 and §9.2.*

---

## 1. Open-Source Libraries & Frameworks
| Dependency | Version / License | Purpose |
| :--- | :--- | :--- |
| **FastAPI** | `0.116.1+` (MIT) | Asynchronous backend API framework |
| **Uvicorn** | `0.34.2+` (BSD) | ASGI server for production API hosting |
| **LightGBM** | `4.6.0+` (MIT) | Quantile gradient boosted tree inference |
| **Pydantic** | `2.11.4+` (MIT) | Runtime data validation and OpenAPI schemas |
| **Pandas / PyArrow** | Apache 2.0 | High-performance synthetic dataset processing |
| **PyJWT** | `2.15.1` (MIT) | HMAC-SHA256 demo authentication token encoding |
| **Next.js** | `14.2.15` (MIT) | Mobile web static export UI framework |
| **React** | `18.3.1` (MIT) | User interface component library |
| **Lucide React** | `0.453.0` (ISC) | Clean mobile icon library |
| **Capacitor** | `6.0.0+` (MIT) | Native Android WebView container wrapper |

---

## 2. Bundled Fonts & Visual Assets
| Asset | Source / License | Notes |
| :--- | :--- | :--- |
| **Hind Siliguri** | Google Fonts (OFL) | Primary Bangla typography bundled locally |
| **Inter** | Google Fonts (OFL) | Primary Latin numbers and UI typography |

---

## 3. AI Coding Assistants & Models
In compliance with Rulebook Section 4.2 and Section 9.2:
- **AI Coding Assistant:** Google DeepMind Antigravity AI Agent (Powered by Gemini) was utilized during pair programming for scaffolding, code generation, and test creation.
- **In-App LLM Runtime:** The application provides a dual architecture:
  1. Fail-closed deterministic template engine (zero external runtime cost or API key dependency).
  2. Optional OpenAI-compatible API adapter for conversational narrative when enabled.
- **ML work (forecaster, evaluation, generator realism):** Anthropic Claude Code (Claude Opus) assisted the ML owner with code changes under `ml/`, `core/`, `data_gen/`. Every metric is produced by `python -m ml.evaluate`; none were written by the assistant.
