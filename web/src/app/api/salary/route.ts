import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { audit, clearInsights } from "@/lib/server/data";

export const dynamic = "force-dynamic";

/**
 * Salary settings (user's explicit option).
 * GET  → current salary settings + what was detected from history
 * POST → update salary amount / pay day; feeds the income-detection layer.
 *
 * Note: recurring income detection still runs on transaction history;
 * the user-declared salary refines estimates when history is ambiguous
 * and powers the salary-based actions (e.g. payday buffer).
 */
export async function GET() {
  try {
    const user = await requireOwner();
    return NextResponse.json({
      salaryAmount: user.salaryAmount,
      salaryPayDay: user.salaryPayDay,
      salaryMerchant: user.salaryMerchant,
      openingBalance: user.openingBalance,
      note: "Recurring income timing is learned from your transaction history; these settings refine the estimate.",
    });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[salary GET]", e);
    return NextResponse.json({ error: "Failed to load salary settings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      salaryAmount?: number | null;
      salaryPayDay?: number | null;
    };

    const data: { salaryAmount?: number | null; salaryPayDay?: number | null } = {};

    if (body.salaryAmount !== undefined) {
      if (body.salaryAmount === null) {
        data.salaryAmount = null;
      } else {
        const amt = Math.round(body.salaryAmount);
        if (!Number.isFinite(amt) || amt < 0 || amt > 10_000_000) {
          return NextResponse.json({ error: "Salary must be between 0 and 10,000,000" }, { status: 400 });
        }
        data.salaryAmount = amt;
      }
    }

    if (body.salaryPayDay !== undefined) {
      if (body.salaryPayDay === null) {
        data.salaryPayDay = null;
      } else {
        const day = Math.round(body.salaryPayDay);
        if (!Number.isFinite(day) || day < 1 || day > 31) {
          return NextResponse.json({ error: "Pay day must be between 1 and 31" }, { status: 400 });
        }
        data.salaryPayDay = day;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const user = await requireOwner();
    const updated = await db.user.update({ where: { id: user.id }, data });
    await clearInsights(user.id); // forecast-related insights must refresh
    await audit(user.id, "salary_updated", data);
    return NextResponse.json({
      salaryAmount: updated.salaryAmount,
      salaryPayDay: updated.salaryPayDay,
      salaryMerchant: updated.salaryMerchant,
    });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[salary POST]", e);
    return NextResponse.json({ error: "Failed to save salary settings" }, { status: 500 });
  }
}
