import { NextResponse } from "next/server";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { getUserTransactions, getActiveGoals, getInsights, insertInsights } from "@/lib/server/data";
import { computeAll } from "@/lib/server/compute";
import { generateInsights } from "@/lib/engine/insights";
import { MODEL_VERSION, type FinancialSummary } from "@/lib/engine/domain";

export const dynamic = "force-dynamic";

/** Financial summary: month snapshot + cash-flow outlook + safe-to-spend + top insight. */
export async function GET() {
  try {
    const user = await requireOwner();
    const anchor = new Date();
    const txns = await getUserTransactions(user.id);
    const goals = await getActiveGoals(user.id);
    const salary = { amount: user.salaryAmount, payDay: user.salaryPayDay };

    const { intel, cash, fc, risk, sts } = computeAll(txns, anchor, user.openingBalance, salary);

    // Insights regenerate whenever they were cleared (any data mutation) —
    // but only once the user actually has history to analyse.
    let insightRows = await getInsights(user.id);
    if (insightRows.length === 0 && txns.length > 0) {
      const generated = generateInsights(intel, txns, anchor, cash.walletBalance, sts, risk);
      await insertInsights(user.id, generated, MODEL_VERSION);
      insightRows = await getInsights(user.id);
    }

    const active = goals.find((g) => g.status === "active") ?? null;

    const savingsChangePct =
      intel.lastMonthIn - intel.lastMonthOut > 0
        ? Math.round(((intel.net - (intel.lastMonthIn - intel.lastMonthOut)) / Math.max(1, intel.lastMonthIn - intel.lastMonthOut)) * 100)
        : null;

    const payload: FinancialSummary = {
      user: {
        id: user.id, name: user.name, preferredLanguage: user.preferredLanguage,
        salaryAmount: user.salaryAmount, salaryPayDay: user.salaryPayDay,
        mode: user.mode === "demo" ? "demo" : "personal",
      },
      month: { inflow: intel.totalIn, outflow: intel.totalOut, estSavings: intel.net },
      lastMonth: { inflow: intel.lastMonthIn, outflow: intel.lastMonthOut },
      savingsChangePct,
      balanceEstimate: cash.walletBalance,
      goalProgress: active
        ? {
            name: active.name,
            pct: Math.min(100, Math.round((active.savedSoFar / active.targetAmount) * 100)),
            target: active.targetAmount,
            saved: active.savedSoFar,
          }
        : null,
      cashflowPressure: fc.pressure,
      shortfallRisk: risk.probability,
      safeToSpend: sts,
      topInsight: insightRows[0]
        ? { title: insightRows[0].title, body: insightRows[0].body, severity: insightRows[0].severity as "positive" | "info" | "warning" | "alert" }
        : null,
      generatedAt: anchor.toISOString(),
    };

    return NextResponse.json(payload);
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[summary]", e);
    return NextResponse.json({ error: "Failed to compute summary" }, { status: 500 });
  }
}
