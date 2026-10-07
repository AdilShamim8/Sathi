import { NextRequest, NextResponse } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, rateLimit, clientKey,
  buildEvidence, ok, unauthorized, notFound, badRequest, tooMany,
  LLM_ENABLED, llmBudgetAllowed,
} from "@/lib/server/sathiApi";
import { generateServerAI, hasServerAISelection, serverAIStatus, type AIGeneration } from "@/lib/server/aiProvider";
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
    // The system prompt is the SLOT PROTOCOL built by the orchestrator: the
    // model may only reference numbers via {{fK}} tokens; trusted values are
    // substituted app-side and validated (fail-closed) afterwards.
    const llmAllowed = LLM_ENABLED && llmBudgetAllowed();
    const generation: { result?: AIGeneration } = {};
    const generateDraft = async (
      cleanedText: string,
      _intent: string,
      systemPrompt: string,
      _loc: "bn" | "en",
    ): Promise<string | null> => {
      if (!llmAllowed) return null;
      if (hasServerAISelection()) {
        generation.result = await generateServerAI(systemPrompt, cleanedText);
        return generation.result.content;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const completion = await Promise.race([
          (async () => {
            const { default: ZAI } = await import("z-ai-web-dev-sdk");
            const zai = await ZAI.create();
            return zai.chat.completions.create({ messages: [
              { role: "system", content: systemPrompt }, { role: "user", content: cleanedText },
            ] });
          })(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("LLM timeout")), 20_000); }),
        ]);
        const content = completion?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim().length >= 5) return content.trim();
      } catch {
        // Fail closed to the deterministic template; never log provider bodies.
      } finally {
        if (timer) clearTimeout(timer);
      }
      return null;
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
      aiStatus: !llmAllowed
        ? { ...serverAIStatus(), state: LLM_ENABLED ? "budget_exhausted" : "disabled" }
        : generation.result
          ? { state: generation.result.content && response.fallbackUsed ? "safety_rejected" : generation.result.state, provider: generation.result.provider, model: generation.result.model }
          : response.generatedText ? { state: "ready", provider: "z-ai", model: null } : serverAIStatus(),
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
