/**
 * OPTIONAL online AI chat via the user's own OpenRouter key (mission 14).
 *
 * - Strictly optional: the app is fully functional without it; the
 *   deterministic copilot always answers first.
 * - The key is stored device-locally (localStorage — app-private storage in
 *   the Android WebView sandbox) and is sent ONLY to openrouter.ai directly
 *   from this device. It never reaches Sathi's servers and is never committed.
 * - The external model may only explain; it can never compute. It receives
 *   the ALREADY-COMPUTED deterministic answer and must reference numbers
 *   exclusively through {{fK}} slot tokens; the client substitutes trusted
 *   values and rejects any bare digit or number word (fail-closed to the
 *   deterministic summary).
 */

const ENABLED_KEY = "sathi-openrouter-enabled";
const API_KEY_STORE = "sathi-openrouter-key";
const MODEL_STORE = "sathi-openrouter-model";
export const DEFAULT_MODEL = "openrouter/auto";

import { toEnglishDigits } from "./formatting";
import { extractNumberWords } from "./llmSafety";

export interface OpenRouterConfig {
  enabled: boolean;
  apiKey: string;
  model: string;
}

export function getOpenRouterConfig(): OpenRouterConfig {
  if (typeof window === "undefined") return { enabled: false, apiKey: "", model: DEFAULT_MODEL };
  return {
    enabled: localStorage.getItem(ENABLED_KEY) === "1",
    apiKey: localStorage.getItem(API_KEY_STORE) ?? "",
    model: localStorage.getItem(MODEL_STORE) || DEFAULT_MODEL,
  };
}

export function setOpenRouterConfig(cfg: Partial<OpenRouterConfig>): void {
  if (typeof window === "undefined") return;
  if (cfg.enabled !== undefined) localStorage.setItem(ENABLED_KEY, cfg.enabled ? "1" : "0");
  if (cfg.apiKey !== undefined) {
    if (cfg.apiKey) localStorage.setItem(API_KEY_STORE, cfg.apiKey);
    else localStorage.removeItem(API_KEY_STORE);
  }
  if (cfg.model !== undefined) localStorage.setItem(MODEL_STORE, cfg.model || DEFAULT_MODEL);
}

/** Facts = the deterministic answer's computed numbers (trusted values). */
function factsFromAnswer(numbers: { label: string; value: string }[]): { key: string; value: string }[] {
  return numbers.slice(0, 12).map((n, i) => ({ key: `f${i + 1}_${n.label}`, value: n.value }));
}

/**
 * Enhance a deterministic copilot answer with the user's OpenRouter model.
 * Returns the rewritten summary, or null on ANY failure (offline, bad key,
 * validator rejection) — the caller keeps the deterministic summary.
 */
export async function enhanceWithOpenRouter(params: {
  question: string;
  deterministicSummary: string;
  numbers: { label: string; value: string }[];
  locale: "bn" | "en";
  timeoutMs?: number;
}): Promise<string | null> {
  const cfg = getOpenRouterConfig();
  if (!cfg.enabled || !cfg.apiKey) return null;
  if (typeof window === "undefined") return null;

  const facts = factsFromAnswer(params.numbers);
  const slotLines = facts.map((f, i) => `{{f${i + 1}}} = ${f.value}`).join("\n");
  const langName = params.locale === "bn" ? "Bangla (বাংলা)" : "English";
  const systemPrompt = [
    `You are Sathi (সাথী), an empathetic AI financial copilot. Rewrite the draft answer so it is warm, clear and non-judgmental (2-3 sentences) in ${langName}.`,
    `NUMBER SAFETY — SLOT PROTOCOL (mandatory):`,
    `- Refer to EVERY number ONLY through its slot token, exactly as written: {{f1}}, {{f2}}, ...`,
    `- NEVER write digits (0-9 or ০-৯) and NEVER write number words (e.g. five thousand, পাঁচ হাজার).`,
    `- Never present forecasts as certainty. Never pressure the user to spend. No regulated financial advice.`,
    `SLOTS (verified values computed by the app):`,
    slotLines || "(no numeric evidence)",
    `Draft answer to rewrite: "${params.deterministicSummary}"`,
  ].join("\n");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 20000);
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${cfg.apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://sathi.app",
        "X-Title": "Sathi Copilot",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: params.question },
        ],
        temperature: 0.2,
        // 900 (was 250): openrouter/auto routes to reasoning models whose
        // hidden chain-of-thought consumed the whole 250-token ceiling and
        // returned content:null (finish_reason "length") — the app then
        // silently fell back to the deterministic answer.
        max_tokens: 900,
      }),
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content || content.length < 5) return null;

    // Client-side validation, same rules as the server: slot ids must be
    // valid, no bare digits, no number words outside slots.
    const rendered = renderSlotsLocal(content, facts);
    return rendered;
  } catch {
    return null; // offline / timeout / CORS — deterministic answer stands
  }
}

/* ---------------- key diagnostics (Settings “Test key”) ---------------- */

export interface OpenRouterTestResult {
  ok: boolean;
  reason: string;
}

/**
 * Minimal live probe used by the Settings sheet so the user can see WHY the
 * optional enhancement is (not) working instead of a silent fallback.
 * Costs one tiny completion on the user's own key.
 */
export async function testOpenRouterKey(
  apiKey = getOpenRouterConfig().apiKey,
  model = getOpenRouterConfig().model || DEFAULT_MODEL,
): Promise<OpenRouterTestResult> {
  if (!apiKey) return { ok: false, reason: "No key entered." };
  const facts = [{ key: "f1_amount", value: "৳123" }];
  const system = [
    "You are testing a financial copilot's NUMBER SAFETY protocol.",
    "Reply with ONE short sentence that refers to the amount ONLY through the slot token {{f1}}.",
    "NEVER write digits or number words yourself. SLOTS: {{f1}} = ৳123",
  ].join("\n");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://sathi.app",
        "X-Title": "Sathi Copilot",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: "How much can I spend?" },
        ],
        temperature: 0,
        max_tokens: 900,
      }),
    });
    clearTimeout(timer);
    if (resp.status === 401) return { ok: false, reason: "Key rejected (401) — check or regenerate it at openrouter.ai." };
    if (resp.status === 402) return { ok: false, reason: "Key has no credits (402) — top up or pick a :free model." };
    if (resp.status === 429) return { ok: false, reason: "Rate limited (429) — free keys allow ~50 requests/day; wait a moment." };
    if (resp.status === 404) return { ok: false, reason: `Model “${model}” not found (404) — pick another model.` };
    if (!resp.ok) return { ok: false, reason: `OpenRouter returned HTTP ${resp.status}.` };
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[]; model?: string };
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim().length < 5) {
      return { ok: false, reason: `Model ${data.model ?? model} returned no text (reasoning model ran out of tokens) — try another model.` };
    }
    const rendered = renderSlotsLocal(content.trim(), facts);
    if (rendered === null) {
      return { ok: false, reason: `Model ${data.model ?? model} ignored the number-safety protocol — try a stronger model.` };
    }
    return { ok: true, reason: `Key + model ${data.model ?? model} work — AI answers will appear in the Copilot when it validates.` };
  } catch {
    return { ok: false, reason: "Could not reach openrouter.ai — check your connection." };
  }
}

/* ---------------- local slot renderer (client-safe) ---------------- */

const SLOT_RE = /\{\{\s*f(\d+)\s*\}\}/g;

function renderSlotsLocal(draft: string, facts: { key: string; value: string }[]): string | null {
  let out = "";
  let pos = 0;
  let ok = true;
  for (const m of draft.matchAll(SLOT_RE)) {
    const idx = Number(m[1]);
    if (!Number.isInteger(idx) || idx < 1 || idx > facts.length) { ok = false; break; }
    out += draft.slice(pos, m.index);
    out += facts[idx - 1]!.value;
    pos = (m.index ?? 0) + m[0].length;
  }
  if (!ok) return null;
  out += draft.slice(pos);
  const rendered = out.trim();
  const residual = draft.replace(SLOT_RE, " ");
  if (/\d/.test(toEnglishDigits(residual))) return null;
  if (extractNumberWords(residual).size > 0) return null;
  if (rendered.length < 5) return null;
  return rendered;
}
