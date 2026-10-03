import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { audit, clearInsights } from "@/lib/server/data";
import { validateTxnCreate } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/**
 * Manual transaction entry (structured form â€” the reliable path for income
 * sources like freelance payments and for precise corrections).
 * body: { amount, direction: "in"|"out", category, merchant?, timestamp? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireOwner();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = validateTxnCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const created = await db.transaction.create({
      data: {
        userId: user.id,
        timestamp: parsed.value.timestamp,
        amount: parsed.value.amount,
        currency: "BDT",
        direction: parsed.value.direction,
        category: parsed.value.category,
        merchant: parsed.value.merchant,
        channel: "wallet",
        source: "manual",
        classificationConfidence: 1,
      },
    });

    await clearInsights(user.id); // insights must never show stale numbers
    await audit(user.id, "manual_transaction_saved", {
      id: created.id, amount: created.amount, direction: created.direction, category: created.category,
    });

    return NextResponse.json({ saved: true, id: created.id });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[transactions/manual POST]", e);
    return NextResponse.json({ error: "Failed to save transaction" }, { status: 500 });
  }
}

