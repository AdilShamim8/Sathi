import { NextRequest, NextResponse } from "next/server";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { getUserTransactions, getActiveGoals, getKnowledgeChunks, audit } from "@/lib/server/data";
import { rateLimit, clientKey, LLM_ENABLED, llmBudgetAllowed } from "@/lib/server/sathiApi";
import { RATE_LIMITS } from "@/lib/engine/sathiConfig";
import { answerQuestion } from "@/lib/engine/copilot";
import { sanitizeInput } from "@/lib/engine/llmSafety";
import { render } from "@/lib/engine/templates";

export const dynamic = "force-dynamic";

// NOTE: no route-specific `maxDuration` here, deliberately. Vercel groups
// routes into serverless functions by config — a lone `maxDuration = 60`
// on this route deployed it as a SEPARATE function with its own /tmp,
// so the copilot queried an empty database while every other route saw
// the user's data ("copilot temporarily unavailable" on the live site).
// All routes must share one function group and one database file.

/**
 * AI Copilot question endpoint.
 * Deterministic engines compute every number; the LLM only rewrites the
 * summary under strict grounding (fail-closed to the deterministic text).
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limit (same window as the v1 chat surface) + LLM kill switch /
    // daily budget — the deterministic answer still flows when the LLM is off.
    if (!rateLimit(clientKey(req, "copilot"), RATE_LIMITS.chat_per_window, RATE_LIMITS.window_s * 1000)) {
      return NextResponse.json({ error: "Too many questions — try again in a minute." }, { status: 429 });
    }

    const body = (await req.json()) as { question?: string };
    const question = (body.question ?? "").trim();
    if (question.length < 2 || question.length > 800) {
      return NextResponse.json({ error: "Question must be 2-800 characters" }, { status: 400 });
    }

    // Sathi prompt sanitizer: refuse adversarial / money-movement intents
    // before any engine or model sees them (fail-closed refusal template).
    const { cleanedText, isSafe } = sanitizeInput(question);
    if (!isSafe) {
      const user0 = await requireOwner();
      await audit(user0.id, "assistant_refusal", { question });
      return NextResponse.json({
        intent: "refusal",
        summary: render("general_refusal", "en"),
        summaryBn: render("general_refusal", "bn"),
        evidence: [],
        numbers: [],
        options: [],
        assumptions: ["Input was blocked by the prompt sanitizer before reaching any model."],
        confidence: "high",
        disclaimer: "Sathi never moves money or makes lending decisions.",
        knowledgeRefs: [],
        llmEnhanced: false,
      });
    }

    const user = await requireOwner();
    const anchor = new Date();
    const [txns, goals, knowledge] = await Promise.all([
      getUserTransactions(user.id),
      getActiveGoals(user.id),
      getKnowledgeChunks(),
    ]);

    const answer = await answerQuestion(cleanedText || question, {
      txns,
      goals,
      knowledge,
      anchor,
      openingBalance: user.openingBalance,
      salary: { amount: user.salaryAmount, payDay: user.salaryPayDay },
      llmAllowed: LLM_ENABLED && llmBudgetAllowed(),
    });

    await audit(user.id, "assistant_query", {
      question,
      intent: answer.intent,
      llmEnhanced: answer.llmEnhanced,
    });
    return NextResponse.json(answer);
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[copilot]", e);
    return NextResponse.json({ error: "The copilot is temporarily unavailable. Your data screens still work." }, { status: 500 });
  }
}

