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
import { formatTaka, formatProbability } from "./formatting";
import { sanitizeInput, validateNumbers } from "./llmSafety";
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
 * so this module stays pure and testable (the server passes the z-ai call).
 */
export async function handleMessage(params: {
  userMessage: string;
  contextData: OrchestratorContext;
  locale?: Locale;
  llmEnabled?: boolean;
  generateDraft?: (cleanedText: string, intent: SathiIntent, ctx: OrchestratorContext, locale: Locale) => Promise<string | null>;
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

  // 2. Generate draft (server-side LLM), 3. validate numbers.
  try {
    const draft = await generateDraft(cleanedText, intent, contextData, locale);
    if (draft) {
      const val = validateNumbers(draft, allowedNumbers);
      if (val.passed) {
        return {
          reply: draft,
          intent,
          evidenceLabels: { narrative: "Generated text" },
          allowedNumbers: [...allowedNumbers].sort((a, b) => a - b),
          generatedText: true,
          validatorPassed: true,
          fallbackUsed: false,
          refusal: false,
        };
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
