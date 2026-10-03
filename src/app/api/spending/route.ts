import { NextResponse } from "next/server";
import { requireOwner, onboardingRequiredResponse, OnboardingRequiredError } from "@/lib/server/guard";
import { getUserTransactions } from "@/lib/server/data";
import { computeAll } from "@/lib/server/compute";

export const dynamic = "force-dynamic";

/** Spending intelligence: categories, recurring, cash-out, month-end, anomalies. */
export async function GET() {
  try {
    const user = await requireOwner();
    const anchor = new Date();
    const txns = await getUserTransactions(user.id);
    const { intel } = computeAll(txns, anchor, user.openingBalance, {
      amount: user.salaryAmount, payDay: user.salaryPayDay,
    });
    return NextResponse.json(intel);
  } catch (e) {
    if (e instanceof OnboardingRequiredError) return onboardingRequiredResponse();
    console.error("[spending]", e);
    return NextResponse.json({ error: "Failed to compute spending intelligence" }, { status: 500 });
  }
}
