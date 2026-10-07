/**
 * OpenRouter integration safety tests (no network — fetch is mocked).
 *
 * Covers the two production failure modes found on 2026-10-04:
 *  1. Reasoning models burning the whole max_tokens budget on hidden
 *     chain-of-thought and returning content:null (finish_reason "length")
 *     -> must fall back to the deterministic answer, never crash.
 *  2. The request must carry a high enough token ceiling (900) so reasoning
 *     models can still produce visible content.
 * Plus the server-side fallback contract in the copilot engine.
 */
import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { enhanceWithOpenRouter, getOpenRouterConfig, setOpenRouterConfig } from "@/lib/engine/openrouterChat";
import { generateServerAI, hasServerAISelection, serverAIStatus } from "@/lib/server/aiProvider";
import { GET as getAIStatus } from "@/app/api/ai/status/route";
import { handleMessage } from "@/lib/engine/orchestrator";
import { answerQuestion } from "@/lib/engine/copilot";
import type { Txn, Goal, KnowledgeChunk } from "@/lib/engine/domain";

// Deterministic tests: neutralize the primary z-ai sdk path so only the
// fallback under test produces drafts. (In this sandbox z-ai actually works,
// which would make these tests environment-dependent.)
mock.module("z-ai-web-dev-sdk", () => ({
  default: {
    create: async () => {
      throw new Error("z-ai disabled in test");
    },
  },
}));

const realFetch = globalThis.fetch;

// Minimal localStorage polyfill for the bun runtime (the browser globals
// exist in production but not under `bun test`).
const store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
} as Storage;
// openrouterChat guards on `typeof window` (browser-only module) and reads
// window.location.origin for the HTTP-Referer header.
(globalThis as { window?: unknown }).window = {
  location: { origin: "https://sathi-test.local" },
};

function mockFetchOnce(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const r = handler(String(url), init);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

beforeEach(() => {
  // enable + key so enhanceWithOpenRouter actually runs
  localStorage.setItem("sathi-openrouter-enabled", "1");
  localStorage.setItem("sathi-openrouter-key", "sk-or-v1-test");
  localStorage.setItem("sathi-openrouter-model", "openrouter/auto");
});

describe("configured server AI providers", () => {
  const envNames = ["SATHI_AI_PROVIDER", "SATHI_GROQ_API_KEY", "SATHI_GROQ_MODEL", "SATHI_OPENROUTER_API_KEY", "SATHI_OPENROUTER_MODEL", "SATHI_OPENAI_API_KEY", "SATHI_OPENAI_MODEL", "SATHI_LLM_ENABLED"];
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
    for (const name of envNames) delete process.env[name];
  });
  afterEach(() => {
    for (const name of envNames) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  });

  test("no key: status is explicit and generation never makes a request", async () => {
    globalThis.fetch = (() => { throw new Error("Must not call provider"); }) as typeof fetch;
    expect(serverAIStatus().state).toBe("not_configured");
    expect(hasServerAISelection()).toBe(false);
    expect((await generateServerAI("system", "user")).state).toBe("not_configured");
  });

  test("an explicit provider never switches to a different account", async () => {
    process.env.SATHI_AI_PROVIDER = "groq";
    process.env.SATHI_OPENROUTER_API_KEY = "test-server-key";
    expect(hasServerAISelection()).toBe(true);
    expect(serverAIStatus()).toEqual({ state: "not_configured", provider: "groq", model: "llama-3.3-70b-versatile" });
    expect((await generateServerAI("system", "user")).content).toBeNull();
  });

  test("invalid provider fails closed instead of using a configured paid account", () => {
    process.env.SATHI_AI_PROVIDER = "https://untrusted.example";
    process.env.SATHI_OPENAI_API_KEY = "test-server-key";
    expect(serverAIStatus().state).toBe("invalid_provider");
    expect(hasServerAISelection()).toBe(true);
  });

  test("Groq uses its fixed HTTPS endpoint and returns only public metadata", async () => {
    process.env.SATHI_GROQ_API_KEY = "test-server-key";
    mockFetchOnce((url, init) => {
      expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-server-key");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("llama-3.3-70b-versatile");
      expect(body.max_tokens).toBe(900);
      return { status: 200, body: { choices: [{ message: { content: "A grounded explanation." } }] } };
    });
    expect((await generateServerAI("system", "user")).content).toBe("A grounded explanation.");
    const response = await getAIStatus();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.text();
    expect(body).not.toContain("test-server-key");
    expect(JSON.parse(body).provider).toBe("groq");
  });

  test("OpenRouter defaults to free routing and preserves explicit models", async () => {
    process.env.SATHI_OPENROUTER_API_KEY = "test-server-key";
    expect(serverAIStatus().model).toBe("openrouter/free");
    process.env.SATHI_OPENROUTER_MODEL = "chosen/model";
    mockFetchOnce((url, init) => {
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(JSON.parse(String(init?.body)).model).toBe("chosen/model");
      return { status: 200, body: { choices: [{ message: { content: "A grounded explanation." } }] } };
    });
    expect((await generateServerAI("s", "u")).state).toBe("ready");
  });

  test("OpenAI uses its own key and model with no automatic cross-provider retry", async () => {
    process.env.SATHI_AI_PROVIDER = "openai";
    process.env.SATHI_OPENAI_API_KEY = "test-server-key";
    process.env.SATHI_GROQ_API_KEY = "other-test-key";
    mockFetchOnce((url, init) => {
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(JSON.parse(String(init?.body)).model).toBe("gpt-4.1-mini");
      return { status: 200, body: { choices: [{ message: { content: "A grounded explanation." } }] } };
    });
    expect((await generateServerAI("s", "u")).provider).toBe("openai");
  });

  for (const [code, state] of [[401, "invalid_key"], [403, "invalid_key"], [402, "no_credits"], [429, "rate_limited"], [404, "model_unavailable"], [500, "unavailable"]] as const) {
    test(`HTTP ${code} keeps the answer available and reports ${state}`, async () => {
      process.env.SATHI_GROQ_API_KEY = "test-server-key";
      mockFetchOnce(() => ({ status: code, body: { error: { message: "private provider error" } } }));
      const result = await generateServerAI("system", "user");
      expect(result.content).toBeNull();
      expect(result.state).toBe(state);
      expect(JSON.stringify(result)).not.toContain("private provider error");
    });
  }

  test("kill switch prevents network requests even when a key is configured", async () => {
    process.env.SATHI_GROQ_API_KEY = "test-server-key";
    process.env.SATHI_LLM_ENABLED = "false";
    globalThis.fetch = (() => { throw new Error("Must not call provider"); }) as typeof fetch;
    expect((await generateServerAI("s", "u")).state).toBe("disabled");
  });

  for (const content of [null, {}, "", "x", "x".repeat(4001)]) {
    test(`malformed or oversized response (${typeof content}, ${String(content).length}) fails closed`, async () => {
      process.env.SATHI_GROQ_API_KEY = "test-server-key";
      mockFetchOnce(() => ({ status: 200, body: { choices: [{ message: { content } }] } }));
      expect((await generateServerAI("s", "u")).state).toBe("empty_response");
    });
  }

  test("network failure and invalid JSON do not break chat", async () => {
    process.env.SATHI_GROQ_API_KEY = "test-server-key";
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    expect((await generateServerAI("s", "u")).state).toBe("unavailable");
    globalThis.fetch = (async () => new Response("not json", { status: 200 })) as typeof fetch;
    expect((await generateServerAI("s", "u")).state).toBe("unavailable");
  });

  test("configured provider preserves financial grounding and does not invoke secondary fallback", async () => {
    const ctx = { txns: [], goals: [], knowledge: [], anchor: new Date("2026-10-07T00:00:00Z"), openingBalance: 10000, salary: { amount: null, payDay: null } };
    let secondaryCalls = 0;
    const bad = await answerQuestion("How much can I safely spend?", {
      ...ctx, llmGenerate: async () => "Spend ৳999,999,999 freely!",
      llmFallback: async () => { secondaryCalls++; return "Another provider's answer."; },
    });
    expect(bad.llmEnhanced).toBe(false);
    expect(bad.summary).not.toContain("999,999,999");
    expect(secondaryCalls).toBe(0);
    const good = await answerQuestion("How much can I safely spend?", { ...ctx, llmGenerate: async () => "Review your budget before deciding to spend." });
    expect(good.llmEnhanced).toBe(true);
    const off = await answerQuestion("How much can I safely spend?", { ...ctx, llmAllowed: false, llmGenerate: async () => { throw new Error("Must not call provider"); } });
    expect(off.llmEnhanced).toBe(false);
  });

  test("v1 slot guard accepts trusted slots and rejects invented figures from the new provider", async () => {
    process.env.SATHI_GROQ_API_KEY = "test-server-key";
    const generateDraft = async (_text: string, _intent: string, system: string) => (await generateServerAI(system, _text)).content;
    mockFetchOnce(() => ({ status: 200, body: { choices: [{ message: { content: "Your balance is {{f1}}." } }] } }));
    const opts = { userMessage: "How much can I spend?", contextData: { balance: 10000, safe_to_spend: 9000 }, locale: "en" as const, llmEnabled: true, generateDraft };
    const good = await handleMessage(opts);
    expect(good.generatedText).toBe(true);
    expect(good.reply).toContain("10000");
    mockFetchOnce(() => ({ status: 200, body: { choices: [{ message: { content: "Spend 99999999 taka freely." } }] } }));
    const bad = await handleMessage(opts);
    expect(bad.fallbackUsed).toBe(true);
    expect(bad.validatorPassed).toBe(false);
  });

  test("browser defaults to free models without replacing a saved model", () => {
    localStorage.removeItem("sathi-openrouter-model");
    expect(getOpenRouterConfig().model).toBe("openrouter/free");
    setOpenRouterConfig({ model: "chosen/model" });
    expect(getOpenRouterConfig().model).toBe("chosen/model");
  });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  localStorage.clear();
});

describe("enhanceWithOpenRouter (client, user's own key)", () => {
  test("reasoning model returning content:null falls back to null (deterministic answer stands)", async () => {
    mockFetchOnce(() => ({
      status: 200,
      body: { choices: [{ message: { content: null, reasoning: "(250 reasoning tokens…)" } }], model: "deepseek/deepseek-v4-flash-0731" },
    }));
    const out = await enhanceWithOpenRouter({
      question: "How much can I spend?",
      deterministicSummary: "Safe to spend is ৳38.",
      numbers: [{ label: "Safe to spend", value: "৳38" }],
      locale: "en",
    });
    expect(out).toBeNull();
  });

  test("request carries the raised 900-token ceiling (was 250 — reasoning models ran dry)", async () => {
    let captured: Record<string, unknown> | null = null;
    mockFetchOnce((_url, init) => {
      captured = JSON.parse(String(init?.body));
      return { status: 200, body: { choices: [{ message: { content: "You can spend {{f1}} today." } }] } };
    });
    const out = await enhanceWithOpenRouter({
      question: "How much?",
      deterministicSummary: "Safe to spend is ৳38.",
      numbers: [{ label: "Safe to spend", value: "৳38" }],
      locale: "en",
    });
    expect((captured as { max_tokens?: number })?.max_tokens).toBe(900);
    expect(out).toBe("You can spend ৳38 today.");
  });

  test("slot-compliant rewrite renders; bare-digit draft is rejected", async () => {
    mockFetchOnce(() => ({ status: 200, body: { choices: [{ message: { content: "You have 38 taka." } }] } }));
    const bad = await enhanceWithOpenRouter({
      question: "How much?",
      deterministicSummary: "Safe to spend is ৳38.",
      numbers: [{ label: "Safe to spend", value: "৳38" }],
      locale: "en",
    });
    expect(bad).toBeNull();
  });

  test("HTTP 401 (bad key) returns null, never throws", async () => {
    mockFetchOnce(() => ({ status: 401, body: { error: { message: "Invalid key" } } }));
    const out = await enhanceWithOpenRouter({
      question: "q", deterministicSummary: "s", numbers: [], locale: "en",
    });
    expect(out).toBeNull();
  });
});

describe("copilot llmFallback (server-side OpenRouter via env key)", () => {
  const anchor = new Date("2026-10-04T00:00:00Z");
  const txns: Txn[] = [
    { id: 1, timestamp: anchor.toISOString(), amount: 12000, currency: "BDT", direction: "in", category: "salary", subcategory: null, merchant: "Employer", channel: "wallet", source: "synthetic", classificationConfidence: 1 },
    { id: 2, timestamp: anchor.toISOString(), amount: 300, currency: "BDT", direction: "out", category: "food", subcategory: null, merchant: "Kacha Bazar", channel: "wallet", source: "synthetic", classificationConfidence: 1 },
  ];
  const goals: Goal[] = [];
  const knowledge: KnowledgeChunk[] = [];

  test("fallback draft with grounded numbers is used and flagged llmEnhanced", async () => {
    // z-ai unavailable: force the primary path off by making it fail —
    // answerQuestion's primary tryLlmSummary imports z-ai-web-dev-sdk which
    // is absent in the test runtime, so it already returns null; the
    // fallback below is what produces the draft.
    const answer = await answerQuestion("How much can I safely spend?", {
      txns, goals, knowledge, anchor, openingBalance: 5000,
      salary: { amount: null, payDay: null },
      llmFallback: async () => "Grounded rewrite that only mentions ৳ figures from the evidence.",
    });
    expect(answer.llmEnhanced).toBe(true);
    expect(answer.summary).toContain("Grounded rewrite");
  });

  test("fallback draft with an invented ৳ figure is rejected (fail-closed)", async () => {
    const answer = await answerQuestion("How much can I safely spend?", {
      txns, goals, knowledge, anchor, openingBalance: 5000,
      salary: { amount: null, payDay: null },
      llmFallback: async () => "You can spend ৳999,999 freely!", // not in evidence
    });
    expect(answer.llmEnhanced).toBe(false);
  });

  test("throwing fallback never breaks the deterministic answer", async () => {
    const answer = await answerQuestion("How much can I safely spend?", {
      txns, goals, knowledge, anchor, openingBalance: 5000,
      salary: { amount: null, payDay: null },
      llmFallback: async () => { throw new Error("network down"); },
    });
    expect(answer.llmEnhanced).toBe(false);
    expect(answer.summary.length).toBeGreaterThan(10);
  });
});
