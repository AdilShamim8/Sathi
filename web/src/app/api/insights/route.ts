import { NextRequest, NextResponse } from "next/server";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { getInsights, insertInsights, clearInsights, getUserTransactions, audit } from "@/lib/server/data";
import { computeAll } from "@/lib/server/compute";
import { generateInsights } from "@/lib/engine/insights";
import { MODEL_VERSION } from "@/lib/engine/domain";
import { getOwnerLiquidity } from "@/lib/server/userInputs";

export const dynamic = "force-dynamic";

/**
 * List persisted insights (with evidence for the WHY panel).
 * Auto-regenerates when the set was cleared by a data mutation.
 */
export async function GET() {
  try {
    const user = await requireOwner();
    let rows = await getInsights(user.id);
    if (rows.length === 0) {
      const txns = await getUserTransactions(user.id);
      if (txns.length > 0) {
        const anchor = new Date();
        const liquidity = await getOwnerLiquidity(user.id, txns, anchor);
        const { intel, cash, risk, sts } = computeAll(txns, anchor, user.openingBalance, {
          amount: user.salaryAmount, payDay: user.salaryPayDay,
        }, 7, liquidity);
        const generated = generateInsights(intel, txns, anchor, cash.walletBalance, sts, risk);
        await insertInsights(user.id, generated, MODEL_VERSION);
        rows = await getInsights(user.id);
      }
    }
    return NextResponse.json(rows);
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[insights GET]", e);
    return NextResponse.json({ error: "Failed to list insights" }, { status: 500 });
  }
}

/** Regenerate insights from current history. */
export async function POST() {
  try {
    const user = await requireOwner();
    const anchor = new Date();
    const txns = await getUserTransactions(user.id);
    if (txns.length === 0) {
      await clearInsights(user.id);
      return NextResponse.json([]);
    }
    const liquidity = await getOwnerLiquidity(user.id, txns, anchor);
    const { intel, cash, risk, sts } = computeAll(txns, anchor, user.openingBalance, {
      amount: user.salaryAmount, payDay: user.salaryPayDay,
    }, 7, liquidity);
    const generated = generateInsights(intel, txns, anchor, cash.walletBalance, sts, risk);

    await clearInsights(user.id);
    await insertInsights(user.id, generated, MODEL_VERSION);
    await audit(user.id, "insights_refreshed", { count: generated.length });
    return NextResponse.json(await getInsights(user.id));
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[insights POST]", e);
    return NextResponse.json({ error: "Failed to refresh insights" }, { status: 500 });
  }
}
