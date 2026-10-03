import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, OnboardingRequiredError } from "@/lib/server/guard";
import { getUserTransactions, goalToDomain } from "@/lib/server/data";
import { analyzeGoal } from "@/lib/engine/goals";

export const dynamic = "force-dynamic";

/** Goal analysis: feasibility, capacity, scenarios. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const goalId = parseInt(searchParams.get("goalId") ?? "0", 10);
    if (!goalId) return NextResponse.json({ error: "goalId is required" }, { status: 400 });

    const user = await requireOwner();
    const rows = await db.goal.findMany({ where: { id: goalId, userId: user.id } });
    if (!rows[0]) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    const txns = await getUserTransactions(user.id);
    const analysis = analyzeGoal(goalToDomain(rows[0]), txns, new Date());
    return NextResponse.json(analysis);
  } catch (e) {
    if (e instanceof OnboardingRequiredError) return onboardingRequiredResponse();
    console.error("[goals/analyze]", e);
    return NextResponse.json({ error: "Failed to analyze goal" }, { status: 500 });
  }
}
