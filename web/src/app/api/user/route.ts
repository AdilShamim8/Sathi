import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { audit, clearInsights } from "@/lib/server/data";

export const dynamic = "force-dynamic";

/**
 * Owner profile: update display name, language preference and/or starting
 * wallet balance (the ledger's anchor for cash-on-hand). Kept separate from
 * salary settings (which live on /api/salary).
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireOwner();
    const body = (await req.json()) as { name?: string; preferredLanguage?: string; openingBalance?: number };
    const data: { name?: string; preferredLanguage?: string; openingBalance?: number } = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) {
        return NextResponse.json({ error: "Name must be 2-80 characters" }, { status: 400 });
      }
      data.name = name;
    }

    if (body.preferredLanguage !== undefined) {
      if (body.preferredLanguage !== "en" && body.preferredLanguage !== "bn") {
        return NextResponse.json({ error: "Language must be \"en\" or \"bn\"" }, { status: 400 });
      }
      data.preferredLanguage = body.preferredLanguage;
    }

    if (body.openingBalance !== undefined) {
      const b = Number(body.openingBalance);
      if (!Number.isFinite(b) || b < 0 || b > 10_000_000) {
        return NextResponse.json({ error: "Starting balance must be between ৳0 and ৳10,000,000" }, { status: 400 });
      }
      data.openingBalance = Math.round(b);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await db.user.update({ where: { id: user.id }, data });
    await clearInsights(user.id);
    await audit(user.id, "profile_updated", data);
    return NextResponse.json({
      name: updated.name,
      preferredLanguage: updated.preferredLanguage,
      mode: updated.mode,
      openingBalance: updated.openingBalance,
    });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[user PATCH]", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
