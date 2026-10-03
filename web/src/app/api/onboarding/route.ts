import { NextRequest, NextResponse } from "next/server";
import { onboardUser, audit, DEFAULT_USER_NAME } from "@/lib/server/data";

export const dynamic = "force-dynamic";

/**
 * Create the owner account (first launch). Idempotent — if an owner already
 * exists the call is treated as a no-op and returns the existing account.
 *
 * body: { name?: string, mode?: "personal" | "demo",
 *         salaryAmount?: number | null, salaryPayDay?: number | null }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    let name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) name = DEFAULT_USER_NAME; // skipped/blank → default
    if (name.length > 80) name = name.slice(0, 80);

    const mode = body.mode === "demo" ? "demo" : "personal";

    let salaryAmount: number | null = null;
    if (body.salaryAmount !== undefined && body.salaryAmount !== null && body.salaryAmount !== "") {
      const n = Number(body.salaryAmount);
      if (Number.isFinite(n) && n >= 0 && n <= 10_000_000) salaryAmount = Math.round(n);
    }

    let salaryPayDay: number | null = null;
    if (body.salaryPayDay !== undefined && body.salaryPayDay !== null && body.salaryPayDay !== "") {
      const d = Number(body.salaryPayDay);
      if (Number.isFinite(d) && d >= 1 && d <= 31) salaryPayDay = Math.round(d);
    }

    let openingBalance = 0;
    if (body.openingBalance !== undefined && body.openingBalance !== null && body.openingBalance !== "") {
      const b = Number(body.openingBalance);
      if (Number.isFinite(b) && b >= 0 && b <= 10_000_000) openingBalance = Math.round(b);
    }

    const user = await onboardUser({ name, mode, salaryAmount, salaryPayDay, openingBalance });
    if (user.name === name && user.mode === mode) {
      // only audit when this call actually created the account
      await audit(user.id, "onboarding", { mode, hasSalary: salaryAmount !== null });
    }
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, mode: user.mode },
    });
  } catch (e) {
    console.error("[onboarding]", e);
    return NextResponse.json({ error: "Failed to complete setup" }, { status: 500 });
  }
}
