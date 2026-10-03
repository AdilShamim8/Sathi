import { NextRequest, NextResponse } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, rateLimit, clientKey,
  buildEvidence, ok, unauthorized, notFound, badRequest, tooMany,
} from "@/lib/server/sathiApi";
import { RATE_LIMITS, ESSENTIALS_PER_DAY_TAKA, THRESHOLDS } from "@/lib/engine/sathiConfig";
import { handleMessage, type OrchestratorContext } from "@/lib/engine/orchestrator";
import { computeMetrics } from "@/lib/engine/metricsEngine";
import { detectCashoutPatterns } from "@/lib/engine/cashout";
import { calculateSafeToSpend, upcomingCommitments } from "@/lib/engine/safeToSpend";
import { detectRecurring, estimateCashOnHand } from "@/lib/engine/analytics";
import { simulateBalancePaths, shortfallStats } from "@/lib/engine/simulation";
import { SIMULATION_CONFIG } from "@/lib/engine/sathiConfig";
import { formatTaka } from "@/lib/engine/formatting";
import { addDays } from "@/lib/engine/timeutils";

export const dynamic = "force-dynamic";

/**
 * Chat (reference: POST /v1/chat) — the full fail-closed pipeline:
 *   sanitize → intent → deterministic engine context → LLM draft (z-ai)
 *   → numeric validation → reviewed bilingual template on ANY failure.
 * The LLM never computes a number; it only rephrases verified figures.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(clientKey(req, "chat"), RATE_LIMITS.chat_per_window, RATE_LIMITS.window_s * 1000)) {
      return tooMany();
    }
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();

    const body = (await req.json().catch(() => null)) as
      | { message?: string; locale?: string }
      | null;
    const message = body?.message?.trim();
    if (!message) return badRequest("message is required");
    if (message.length > 500) return badRequest("message too long (max 500 chars)");
    const locale = body?.locale === "en" ? "en" : "bn";

    const { txns } = await personaTxns(user.id);
    const anchor = new Date();

    // ---- deterministic engine context (the LLM's ONLY numbers) ----
    const cash = estimateCashOnHand(txns, anchor, user.openingBalance, {
      amount: user.salaryAmount, payDay: user.salaryPayDay,
    });
    const metrics = computeMetrics(txns, cash.walletBalance, ESSENTIALS_PER_DAY_TAKA);
    const recurringOut = detectRecurring(txns).filter((r) => r.direction === "out");
    const commitments = upcomingCommitments(recurringOut, anchor, 14);
    const sts = calculateSafeToSpend({
      walletBalance: cash.walletBalance,
      upcomingCommitments: commitments,
      dailyEssentials: Math.max(ESSENTIALS_PER_DAY_TAKA, Math.round(metrics.monthlySpend / 30)),
      horizonDays: 14,
      monthlySavingsTarget: 0,
    });

    // Block-bootstrap shortfall probability + trough date.
    const dailyNets = new Map<string, number>();
    for (const t of txns) {
      const key = t.timestamp.slice(0, 10);
      dailyNets.set(key, (dailyNets.get(key) ?? 0) + (t.direction === "in" ? t.amount : -t.amount));
    }
    const sortedKeys = [...dailyNets.keys()].sort();
    const paths = simulateBalancePaths({
      residuals: sortedKeys.length ? sortedKeys.map((k) => dailyNets.get(k)!) : [-ESSENTIALS_PER_DAY_TAKA],
      startBalance: cash.walletBalance,
      horizonDays: THRESHOLDS.shortfall_horizon_days,
      blockLengthDays: SIMULATION_CONFIG.block_length_days,
      nPaths: SIMULATION_CONFIG.n_paths,
      seed: parseInt(anchor.toISOString().slice(0, 10).replace(/-/g, ""), 10),
    });
    const { pShortfall, medianTroughDay } = shortfallStats(
      paths, ESSENTIALS_PER_DAY_TAKA, Math.min(cash.daysToNextIncome ?? THRESHOLDS.shortfall_horizon_days, THRESHOLDS.shortfall_horizon_days),
    );
    const troughDate = medianTroughDay
      ? addDays(anchor, medianTroughDay).toISOString().slice(0, 10)
      : null;

    // Cash-out audit (trailing 90 days).
    const window = txns.filter(
      (t) => new Date(t.timestamp).getTime() > anchor.getTime() - 90 * 24 * 3600 * 1000,
    );
    const cashout = detectCashoutPatterns(window);

    const contextData: OrchestratorContext = {
      balance: cash.walletBalance,
      safe_to_spend: sts.safeToSpendTotal,
      daily_safe_budget: sts.dailySafeBudget,
      shortfall_prob: Math.round(pShortfall * 100) / 100,
      horizon_days: THRESHOLDS.shortfall_horizon_days,
      trough_date: troughDate,
      min_balance: Math.round(cash.walletBalance - commitments),
      replaceable_fee_saved: cashout.replaceableFeeSaved,
      target: 10000,
      months: 6,
      monthly_income: metrics.monthlyIncome,
      monthly_spend: metrics.monthlySpend,
    };

    // ---- LLM draft generator (z-ai sdk, server-side) ----
    const generateDraft = async (
      cleanedText: string,
      intent: string,
      ctx: OrchestratorContext,
      loc: "bn" | "en",
    ): Promise<string | null> => {
      try {
        const { default: ZAI } = await import("z-ai-web-dev-sdk");
        const zai = await ZAI.create();
        const langName = loc === "bn" ? "Bangla (বাংলা)" : "English";
        const contextLines = Object.entries(ctx)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n");
        const systemPrompt = [
          `You are Sathi (সাথী), an empathetic and certified AI financial copilot for mobile wallet users in Bangladesh.`,
          `Respond politely and conversationally in ${langName}.`,
          `Keep your response concise (2-3 sentences max). Refer to figures naturally (e.g. "৳2,000", "about 35%") — never mention field names like safe_to_spend or daily_safe_budget.`,
          `CRITICAL SAFETY RULE: You must ONLY reference the exact numerical figures provided in the verified context below.`,
          `Never invent ungrounded numbers or make unauthorized investment guarantees.`,
          ``,
          `VERIFIED CONTEXT:`,
          contextLines,
        ].join("\n");
        const completion = await zai.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: cleanedText },
          ],
        });
        const content = completion?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim().length >= 5) return content.trim();
        return null;
      } catch (err) {
        console.warn("[v1 chat] LLM unavailable, failing closed:", err instanceof Error ? err.message : err);
        return null;
      }
    };

    const response = await handleMessage({
      userMessage: message,
      contextData,
      locale,
      llmEnabled: true,
      generateDraft,
    });

    const data = {
      reply: response.reply,
      intent: response.intent,
      generated_text: response.generatedText,
      validator: {
        passed: response.validatorPassed,
        fallback_used: response.fallbackUsed,
        refusal: response.refusal,
      },
      safe_to_spend_display: formatTaka(sts.safeToSpendTotal, locale),
    };

    const evidence = buildEvidence({
      nTransactions: txns.length,
      windowStart: txns.length ? txns[0].timestamp.slice(0, 10) : anchor.toISOString().slice(0, 10),
      asOfDate: anchor.toISOString().slice(0, 10),
      labels: response.evidenceLabels,
      generatedText: response.generatedText,
      promptVersion: "sathi-orchestrator-v1",
      validatorPassed: response.validatorPassed,
      fallbackUsed: response.fallbackUsed,
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 chat]", e);
    return NextResponse.json({ error: { code: "internal", message: "Chat failed" } }, { status: 500 });
  }
}
