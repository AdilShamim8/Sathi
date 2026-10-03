import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientKey, badRequest } from "@/lib/server/sathiApi";
import { RATE_LIMITS } from "@/lib/engine/sathiConfig";
import { parseExpenseText } from "@/lib/engine/nlp";
import { toEnglishDigits } from "@/lib/engine/formatting";
import type { Locale } from "@/lib/engine/formatting";

export const dynamic = "force-dynamic";

/**
 * Natural-language amount + category parser (reference: POST /v1/parse-amount).
 * Bangla digits, Banglish and English all parse. Deterministic â€” no LLM.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(clientKey(req, "parse-amount"), RATE_LIMITS.parse_amount_per_window, RATE_LIMITS.window_s * 1000)) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many parses â€” wait a minute." } },
        { status: 429 },
      );
    }
    const body = (await req.json().catch(() => null)) as { text?: string; locale?: string } | null;
    const text = body?.text?.trim();
    if (!text) return badRequest("text is required");
    const locale: Locale = body?.locale === "en" ? "en" : "bn";

    const parsed = parseExpenseText(toEnglishDigits(text), new Date());
    return NextResponse.json({
      amount: parsed.amount,
      currency: "BDT",
      category: parsed.category,
      direction: parsed.direction,
      confidence: 1,
      note: locale === "bn" ? "à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦¿à¦¤ à¦ªà¦¾à¦°à§à¦¸à¦¾à¦° â€” à¦•à§‹à¦¨à§‹ LLM à¦¨à¦¯à¦¼" : "Deterministic parser â€” no LLM involved",
    });
  } catch (e) {
    console.error("[v1 parse-amount]", e);
    return NextResponse.json({ error: { code: "internal", message: "Parse failed" } }, { status: 500 });
  }
}

