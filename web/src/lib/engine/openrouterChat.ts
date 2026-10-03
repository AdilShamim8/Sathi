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
    const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 15000);
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
        max_tokens: 250,
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
