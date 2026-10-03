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
import { enhanceWithOpenRouter } from "@/lib/engine/openrouterChat";
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
