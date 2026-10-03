import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { getUserTransactions, goalToDomain, audit } from "@/lib/server/data";
import { simulateGoal } from "@/lib/engine/goals";

export const dynamic = "force-dynamic";

/** What-if simulation: extra savings and/or category cut. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      goalId?: number;
      extraMonthlySavings?: number;
      cutCategory?: string;
      cutPct?: number;
    };
    const goalId = Math.round(body.goalId ?? 0);
    if (!goalId) return NextResponse.json({ error: "goalId is required" }, { status: 400 });

    const user = await requireOwner();
    const rows = await db.goal.findMany({ where: { id: goalId, userId: user.id } });
    if (!rows[0]) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    const txns = await getUserTransactions(user.id);
    const result = simulateGoal({
      goal: goalToDomain(rows[0]),
      txns,
      anchor: new Date(),
      extraMonthlySavings: body.extraMonthlySavings ? Math.max(0, Math.min(1_000_000, Math.round(body.extraMonthlySavings))) : undefined,
      cutCategory: body.cutCategory,
      cutPct: body.cutPct ? Math.max(0, Math.min(100, body.cutPct)) : undefined,
    });
    await audit(user.id, "goal_simulated", body);
    return NextResponse.json(result);
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[goals/simulate]", e);
    return NextResponse.json({ error: "Failed to simulate goal" }, { status: 500 });
  }
}

