import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, OnboardingRequiredError } from "@/lib/server/guard";
import { audit, clearInsights } from "@/lib/server/data";
import { validateTxnPatch } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** Edit an existing transaction (owner's ledger stays correctable). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireOwner();
    const { id } = await params;
    const txnId = parseInt(id, 10);
    if (!txnId) return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });

    const existing = await db.transaction.findFirst({ where: { id: txnId, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validateTxnPatch(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const updated = await db.transaction.update({
      where: { id: txnId },
      data: parsed.value,
    });

    await clearInsights(user.id);
    await audit(user.id, "transaction_edited", { id: txnId, changes: parsed.value });

    return NextResponse.json({ saved: true, id: updated.id });
  } catch (e) {
    if (e instanceof OnboardingRequiredError) return onboardingRequiredResponse();
    console.error("[transactions/[id] PATCH]", e);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

/** Delete a transaction (owner can remove wrong entries entirely). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireOwner();
    const { id } = await params;
    const txnId = parseInt(id, 10);
    if (!txnId) return NextResponse.json({ error: "Invalid transaction id" }, { status: 400 });

    const existing = await db.transaction.findFirst({ where: { id: txnId, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    await db.transaction.delete({ where: { id: txnId } });

    await clearInsights(user.id);
    await audit(user.id, "transaction_deleted", {
      id: txnId, amount: existing.amount, direction: existing.direction,
    });

    return NextResponse.json({ deleted: true, id: txnId });
  } catch (e) {
    if (e instanceof OnboardingRequiredError) return onboardingRequiredResponse();
    console.error("[transactions/[id] DELETE]", e);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
