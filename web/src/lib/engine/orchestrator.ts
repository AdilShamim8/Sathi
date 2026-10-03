/**
 * LLM Intent Orchestrator — ported from Sathi llm/orchestrator.py
 * (reference architecture §6 / §12, invariants 1, 2, 7).
 *
 * - Routes user messages to pure engine outputs by intent.
 * - Sanitizes input; refuses adversarial/prohibited intents.
 * - Compiles the allowed-number ground truth from verified engine output
 *   (including taka equivalents of every paisa figure).
 * - Generates a draft with the LLM (z-ai sdk), then validates every number
 *   in the draft against the ground truth.
 * - FAILS CLOSED to the reviewed bilingual templates when validation fails
 *   or the LLM is unavailable. The product always answers.
 */

import type { Locale } from "./formatting";
import { formatTaka, formatProbability, toBanglaDigits, toEnglishDigits } from "./formatting";
import { sanitizeInput, validateNumbers, extractNumberWords } from "./llmSafety";
import {
  render, templateVarsSafeSpend, templateVarsForecastRisk, templateVarsForecastSafe,
  templateVarsGoal, templateVarsIncomeSpend,
} from "./templates";

export type SathiIntent =
  | "greeting"
  | "safe_spend"
  | "forecast"
  | "cashout"
  | "goal"
  | "summary"
  | "general";

export interface OrchestratorResponse {
  reply: string;
  intent: SathiIntent | "refusal";
  evidenceLabels: Record<string, string>;
  allowedNumbers: number[];
  generatedText: boolean;
  validatorPassed: boolean;
  fallbackUsed: boolean;
  refusal: boolean;
}

/* Keyword intent matcher — deterministic routing & fallback. */
const INTENT_PATTERNS: [SathiIntent, RegExp][] = [
  ["greeting", /(hello|hi|hey|assalamu|salam|সালাম|হ্যালো|নমস্কার|কেমন|আদাব)/i],
  ["safe_spend", /(নিরাপদ|বাজেট|কত খরচ|safe to spend|can i spend|budget|daily|প্রতিদিন|খরচ করতে পারব)/i],
  ["forecast", /(টানাটানি|ঘাটতি|ভবিষ্যত|সামনে|আগামী|পূর্বাভাস|forecast|shortfall|predict|future|risk|ঝুঁকি)/i],
  ["cashout", /(ক্যাশ-?আউট|এজেন্ট|ফি|cashout|cash-?out|fee|agent)/i],
  ["goal", /(সঞ্চয়|লক্ষ্য|জমাতে|সেভ|goal|save|savings|plan)/i],
  ["summary", /(ব্যালেন্স|হিসাব|লেনদেন|আয়|খরচ|summary|balance|income|spend|transactions)/i],
];

export function detectIntent(text: string): SathiIntent {
  for (const [intent, re] of INTENT_PATTERNS) {
    if (re.test(text)) return intent;
  }
  return "general";
}

/* ---------------- slot-based narration (mission P0) ----------------
 * The LLM may ONLY reference numbers through {{fK}} slot tokens. The app
 * substitutes trusted, pre-formatted values; any bare digit or number word
 * in the draft fails closed to the reviewed template. */
const SLOT_RE = /\{\{\s*f(\d+)\s*\}\}/g;
const BARE_DIGIT_RE = /\d/;

export interface Fact {
  key: string;
  value: string;
}

/** Flatten the verified context into ordered formatted facts (the LLM's slots). */
export function buildFacts(ctx: OrchestratorContext, locale: Locale): Fact[] {
  const facts: Fact[] = [];
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === "boolean" || v === null || v === undefined) continue;
    if (typeof v === "number" && Number.isFinite(v)) {
      if (k.endsWith("_paisa")) {
        facts.push({ key: k, value: formatTaka(v / 100, locale) });
      } else if (k.includes("prob")) {
        facts.push({ key: k, value: formatProbability(v, locale) });
      } else {
        const s = String(Math.round(v));
        facts.push({ key: k, value: locale === "bn" ? toBanglaDigits(s) : s });
      }
    } else if (typeof v === "string" && v.length) {
      facts.push({ key: k, value: v });
    }
  }
  return facts;
}

/** Build the slot-protocol system prompt the LLM must follow. */
export function slotSystemPrompt(facts: Fact[], locale: Locale, extraContext?: string): string {
  const langName = locale === "bn" ? "Bangla (বাংলা)" : "English";
  const slotLines = facts.map((f, i) => `{{f${i + 1}}} = ${f.key} = ${f.value}`).join("\n");
  return [
    `You are Sathi (সাথী), an empathetic AI financial copilot for mobile wallet users in Bangladesh.`,
    `Respond warmly and conversationally in ${langName}, 2-3 sentences.`,
    `NUMBER SAFETY — SLOT PROTOCOL (mandatory):`,
    `- Refer to EVERY number ONLY through its slot token, exactly as written: {{f1}}, {{f2}}, ...`,
    `- NEVER write digits yourself (0-9 or ০-৯) and NEVER write number words (e.g. five thousand, পাঁচ হাজার).`,
    `- Do not mention field names like safe_to_spend. Use the slot token where the value belongs.`,
    `- If no slot fits, speak qualitatively (e.g. "a few days").`,
    `SLOTS (verified values, inserted by the app):`,
    slotLines,
    extraContext ?? "",
  ].filter(Boolean).join("\n");
}

/**
 * Validate a slot-token draft and substitute trusted values. Returns null
 * (fail closed) when the draft references an unknown slot id or contains any
 * bare digit or number word outside slot tokens.
 */
export function renderSlots(draft: string, facts: Fact[]): string | null {
  if (!draft) return null;
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
  // Residual (non-slot) text must be number-free: no digits, no number words.
  const residual = draft.replace(SLOT_RE, " ");
  if (BARE_DIGIT_RE.test(toEnglishDigits(residual))) return null;
  if (extractNumberWords(residual).size > 0) return null;
  if (rendered.length < 5) return null;
  return rendered;
}

/** Verified context produced by deterministic engines — the LLM's only numbers. */
export interface OrchestratorContext {
  [key: string]: number | string | null | undefined;
}

/** Map intent → reviewed template + pre-formatted variables. */
function resolveTemplateVars(
  intent: SathiIntent,
  ctx: OrchestratorContext,
  locale: Locale,
): { name: Parameters<typeof render>[0]; vars: Record<string, string> } {
  switch (intent) {
    case "greeting":
      return { name: "greeting", vars: {} };
    case "safe_spend":
      return {
        name: "safe_spend",
        vars: templateVarsSafeSpend({
          balance: num(ctx.balance, 0),
          safeSpend: num(ctx.safe_to_spend, num(ctx.balance, 0)),
          dailyBudget: num(ctx.daily_safe_budget, 0),
        }, locale),
      };
    case "forecast": {
      const prob = num(ctx.shortfall_prob, 0);
      const horizon = String(num(ctx.horizon_days, 14));
      const trough = str(ctx.trough_date, locale === "bn" ? "পরের সপ্তাহ" : "next week");
      if (prob > 0.3) {
        return {
          name: "forecast_risk",
          vars: {
            horizon: locale === "bn" ? bnDigitsOf(horizon) : horizon,
            shortfall_prob: formatProbability(prob, locale),
            trough_date: trough,
          },
        };
      }
      return {
        name: "forecast_safe",
        vars: {
          horizon: locale === "bn" ? bnDigitsOf(horizon) : horizon,
          min_balance: formatTaka(num(ctx.min_balance, 0), locale),
          trough_date: trough,
        },
      };
    }
    case "cashout":
      return {
        name: "cashout_audit",
        vars: { savings: formatTaka(num(ctx.replaceable_fee_saved, 0), locale) },
      };
    case "goal":
      return {
        name: "goal_plan",
        vars: templateVarsGoal({ target: num(ctx.target, 10000), months: num(ctx.months, 6) }, locale),
      };
    case "summary":
      return {
        name: "summary_income_spend",
        vars: templateVarsIncomeSpend(
          { income: num(ctx.monthly_income, 0), spend: num(ctx.monthly_spend, 0) }, locale,
        ),
      };
    default:
      return { name: "general_help", vars: {} };
  }
}

function num(v: unknown, d: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}
function str(v: unknown, d: string): string {
  return typeof v === "string" && v.length ? v : d;
}
function bnDigitsOf(s: string): string {
  return s.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);
}

/**
 * Full fail-closed pipeline over engine context. `generateDraft` is injected
 * so this module stays pure and testable (the server passes the z-ai call and
 * receives the SLOT-PROTOCOL system prompt built here).
 */
export async function handleMessage(params: {
  userMessage: string;
  contextData: OrchestratorContext;
  locale?: Locale;
  llmEnabled?: boolean;
  generateDraft?: (cleanedText: string, intent: SathiIntent, systemPrompt: string, locale: Locale) => Promise<string | null>;
}): Promise<OrchestratorResponse> {
  const { userMessage, contextData, locale = "bn", llmEnabled = true, generateDraft } = params;

  // 0. Sanitize — refuse adversarial or prohibited intents.
  const { cleanedText, isSafe } = sanitizeInput(userMessage);
  if (!isSafe) {
    return {
      reply: render("general_refusal", locale),
      intent: "refusal",
      evidenceLabels: { refusal: "Data" },
      allowedNumbers: [],
      generatedText: false,
      validatorPassed: true,
      fallbackUsed: true,
      refusal: true,
    };
  }

  const intent = detectIntent(cleanedText);

  // Compile ground-truth allowed numbers from verified context.
  const allowedNumbers = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 14, 21, 30]);
  for (const [k, v] of Object.entries(contextData)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      allowedNumbers.add(v);
      if (k.endsWith("_paisa")) {
        allowedNumbers.add(Math.floor(v / 100));
        allowedNumbers.add(Math.round((v / 100) * 100) / 100);
      }
    }
  }

  const fallback = () => {
    const { name, vars } = resolveTemplateVars(intent, contextData, locale);
    return {
      reply: render(name, locale, vars),
      evidenceLabels: { narrative: "Data" as const },
      allowedNumbers: [...allowedNumbers].sort((a, b) => a - b),
      generatedText: false,
      validatorPassed: true,
      fallbackUsed: true,
      refusal: false,
    };
  };

  // 1. LLM disabled → template directly.
  if (!llmEnabled || !generateDraft) {
    return { ...fallback(), intent };
  }

  // 2. Generate a SLOT-PROTOCOL draft, validate slots, substitute values.
  try {
    const facts = buildFacts(contextData, locale);
    const system = slotSystemPrompt(facts, locale);
    const draft = await generateDraft(cleanedText, intent, system, locale);
    if (draft) {
      const rendered = renderSlots(draft, facts);
      if (rendered !== null) {
        // Defense in depth: the substituted text must still be grounded.
        const val = validateNumbers(rendered, allowedNumbers);
        if (val.passed) {
          return {
            reply: rendered,
            intent,
            evidenceLabels: { narrative: "Generated text" },
            allowedNumbers: [...allowedNumbers].sort((a, b) => a - b),
            generatedText: true,
            validatorPassed: true,
            fallbackUsed: false,
            refusal: false,
          };
        }
      }
      // Fail closed! Use the reviewed template instead.
      const fb = fallback();
      return { ...fb, intent, validatorPassed: false };
    }
  } catch {
    // LLM unavailable → fall through to template (fail-closed, never blank).
  }

  return { ...fallback(), intent };
}
