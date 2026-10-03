import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { audit, clearInsights, goalToDomain } from "@/lib/server/data";
import { validateGoalPatch } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** Edit a goal: rename, retarget, adjust timeline, update saved amount or status. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireOwner();
    const { id } = await params;
    const goalId = parseInt(id, 10);
    if (!goalId) return NextResponse.json({ error: "Invalid goal id" }, { status: 400 });

    const existing = await db.goal.findFirst({ where: { id: goalId, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validateGoalPatch(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const patch = parsed.value;

    // compute the new target date / monthly commitment when the plan changes
    let targetDate = existing.targetDate;
    if (patch.months !== undefined) {
      targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + patch.months);
    }

    const targetAmount = patch.targetAmount ?? existing.targetAmount;
    const savedSoFar = patch.savedSoFar ?? existing.savedSoFar;
    const months = patch.months ?? Math.max(
      1,
      Math.round((targetDate.getTime() - Date.now()) / (30.44 * 24 * 3600 * 1000)),
    );
    const monthlyCommitment = Math.ceil(Math.max(0, targetAmount - savedSoFar) / months);

    const updated = await db.goal.update({
      where: { id: goalId },
      data: {
        ...patch,
        targetDate,
        monthlyCommitment,
      },
    });

    await clearInsights(user.id);
    await audit(user.id, "goal_edited", { id: goalId, changes: patch });

    return NextResponse.json({ saved: true, goal: goalToDomain(updated) });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[goals/[id] PATCH]", e);
    return NextResponse.json({ error: "Failed to update goal" }, { status: 500 });
  }
}

/** Delete a goal permanently (vs PATCH status="dropped" which archives it). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireOwner();
    const { id } = await params;
    const goalId = parseInt(id, 10);
    if (!goalId) return NextResponse.json({ error: "Invalid goal id" }, { status: 400 });

    const existing = await db.goal.findFirst({ where: { id: goalId, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

    await db.goal.delete({ where: { id: goalId } });

    await clearInsights(user.id);
    await audit(user.id, "goal_deleted", { id: goalId, name: existing.name });

    return NextResponse.json({ deleted: true, id: goalId });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[goals/[id] DELETE]", e);
    return NextResponse.json({ error: "Failed to delete goal" }, { status: 500 });
  }
}
