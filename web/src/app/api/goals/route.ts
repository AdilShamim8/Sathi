import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { getActiveGoals, goalToDomain, audit, clearInsights } from "@/lib/server/data";

export const dynamic = "force-dynamic";

/** List active goals. */
export async function GET() {
  try {
    const user = await requireOwner();
    const goals = await getActiveGoals(user.id);
    return NextResponse.json(goals);
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[goals GET]", e);
    return NextResponse.json({ error: "Failed to list goals" }, { status: 500 });
  }
}

/**
 * Create a goal. Multiple active goals are supported â€” creating one never
 * touches the others (edit/archive/delete happen via /api/goals/[id]).
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string; targetAmount?: number; months?: number; savedSoFar?: number;
    };
    const name = (body.name ?? "").trim();
    const targetAmount = Math.round(body.targetAmount ?? 0);
    const months = Math.round(body.months ?? 0);
    const savedSoFar = Math.max(0, Math.round(body.savedSoFar ?? 0));

    if (name.length < 2 || name.length > 160) {
      return NextResponse.json({ error: "Goal name must be 2-160 characters" }, { status: 400 });
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 100_000_000) {
      return NextResponse.json({ error: "Target amount must be between 1 and 100,000,000" }, { status: 400 });
    }
    if (!Number.isFinite(months) || months < 1 || months > 120) {
      return NextResponse.json({ error: "Months must be between 1 and 120" }, { status: 400 });
    }
    if (savedSoFar > targetAmount) {
      return NextResponse.json({ error: "Saved so far cannot exceed the target amount" }, { status: 400 });
    }

    const user = await requireOwner();

    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + months);
    const created = await db.goal.create({
      data: {
        userId: user.id,
        name,
        targetAmount,
        targetDate,
        savedSoFar,
        monthlyCommitment: Math.ceil((targetAmount - savedSoFar) / months),
        status: "active",
      },
    });
    await clearInsights(user.id);
    await audit(user.id, "goal_created", { name, targetAmount, months, savedSoFar });
    return NextResponse.json({ id: created.id, goal: goalToDomain(created) });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[goals POST]", e);
    return NextResponse.json({ error: "Failed to create goal" }, { status: 500 });
  }
}

