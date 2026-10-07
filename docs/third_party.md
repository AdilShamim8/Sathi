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
| **Next.js** | `16.1.3` resolved in reviewed workspace (MIT) | Hosted web app and server API routes |
| **React** | `19.2.3` resolved in reviewed workspace (MIT) | User interface component library |
| **Lucide React** | `0.525.0` resolved in reviewed workspace (ISC) | Mobile interface icons |
| **Capacitor** | `6.2.2` resolved core in reviewed workspace (MIT) | Android WebView container wrapper |

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
- **Deadline review and fixes (7 October 2026):** OpenAI Codex assisted repository review, financial workflow corrections, provider configuration, regression tests and presentation-readiness notes. Earlier authorship statements above describe the existing project disclosures and were not independently audited during this review.

## 4. Optional Online AI Services

| Service | Use | Configuration and limits |
|---|---|---|
| Groq | Server-side explanation of computed financial evidence | Account key required; free-tier limits and model availability depend on the account |
| OpenRouter | Server-side or explicitly enabled device-local explanation | Key required; `openrouter/free` routes to available free models with limits; other models may require credits |
| OpenAI | Optional server-side GPT explanation | Separate API account and billing; not included with a ChatGPT subscription |
| z-ai web development SDK | Existing legacy narration gateway when no shared provider is selected | Availability depends on its deployment configuration |

Provider replies pass the existing financial validators. Missing keys, model or
quota errors and invalid drafts preserve built-in answers. Enabling AI sends the
question and relevant computed evidence to the selected provider. No provider
credential is included in these disclosures or committed to the repository.
