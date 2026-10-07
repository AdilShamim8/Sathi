import { NextRequest, NextResponse } from "next/server";
import { requireOwner, onboardingRequiredResponse, isOnboardingRequiredError } from "@/lib/server/guard";
import { getUserTransactions, clearInsights } from "@/lib/server/data";
import { getUserInputs, upsertUserInputs, effectiveCashOnHand } from "@/lib/server/userInputs";

export const dynamic = "force-dynamic";

/**
 * Owner-surface liquidity corrections (the app UI twin of POST /v1/me/inputs).
 *
 * GET  /api/inputs → current declared inputs + the effective cash actually used
 * POST /api/inputs → { cashOnHandTaka?, incomeDay?, rentAmountTaka?,
 *                      rentConfirmed?, otherLiquidTaka? }
 *
 * A declared cash amount decays forward at the observed daily cash burn, so it
 * can never permanently overstate liquidity. The next summary / safe-to-spend
 * recomputation picks the values up immediately.
 */
export async function GET() {
  try {
    const user = await requireOwner();
    const txns = await getUserTransactions(user.id);
    const inputs = await getUserInputs(user.id);
    const eff = effectiveCashOnHand(txns, new Date(), inputs.cashOnHandTaka, inputs.cashOnHandUpdatedAt);
    return NextResponse.json({
      cashOnHandTaka: inputs.cashOnHandTaka,
      incomeDay: inputs.incomeDay,
      rentAmountTaka: inputs.rentAmountTaka,
      rentConfirmed: inputs.rentConfirmed,
      otherLiquidTaka: inputs.otherLiquidTaka,
      updatedAt: inputs.updatedAt?.toISOString() ?? null,
      effectiveCashOnHandTaka: eff.cashTaka,
      source: eff.source,
    });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[inputs GET]", e);
    return NextResponse.json({ error: "Failed to load inputs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireOwner();
    const body = (await req.json().catch(() => null)) as {
      cashOnHandTaka?: number;
      incomeDay?: number;
      rentAmountTaka?: number;
      rentConfirmed?: boolean;
      otherLiquidTaka?: number;
    } | null;
    if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });

    const int = (v: unknown, lo: number, hi: number, name: string): number | undefined => {
      if (v === undefined || v === null) return undefined;
      const n = Number(v);
      if (!Number.isInteger(n) || n < lo || n > hi) throw new RangeError(`${name} must be an integer in [${lo}, ${hi}]`);
      return n;
    };
    let patch: Parameters<typeof upsertUserInputs>[1];
    try {
      patch = {
        cashOnHandTaka: int(body.cashOnHandTaka, 0, 10_000_000, "cashOnHandTaka"),
        incomeDay: int(body.incomeDay, 1, 31, "incomeDay"),
        rentAmountTaka: int(body.rentAmountTaka, 0, 10_000_000, "rentAmountTaka"),
        rentConfirmed: typeof body.rentConfirmed === "boolean" ? body.rentConfirmed : undefined,
        otherLiquidTaka: int(body.otherLiquidTaka, 0, 10_000_000, "otherLiquidTaka"),
      };
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    if (Object.values(patch).every((v) => v === undefined)) {
      return NextResponse.json({ error: "Provide at least one input field" }, { status: 400 });
    }

    const saved = await upsertUserInputs(user.id, patch);
    await clearInsights(user.id);
    return NextResponse.json({
      cashOnHandTaka: saved.cashOnHandTaka,
      incomeDay: saved.incomeDay,
      rentAmountTaka: saved.rentAmountTaka,
      rentConfirmed: saved.rentConfirmed,
      otherLiquidTaka: saved.otherLiquidTaka,
      updatedAt: saved.updatedAt?.toISOString() ?? null,
    });
  } catch (e) {
    if (isOnboardingRequiredError(e)) return onboardingRequiredResponse();
    console.error("[inputs POST]", e);
    return NextResponse.json({ error: "Failed to save inputs" }, { status: 500 });
  }
}
