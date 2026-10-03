import { NextRequest } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, buildEvidence, ok, unauthorized, notFound, badRequest,
} from "@/lib/server/sathiApi";
import { getUserInputs, upsertUserInputs, effectiveCashOnHand } from "@/lib/server/userInputs";
import { formatTaka } from "@/lib/engine/formatting";
import { MODEL_VERSION } from "@/lib/engine/domain";

export const dynamic = "force-dynamic";

/**
 * User inputs (mission P0) — liquidity corrections.
 *
 * GET  /api/v1/me/inputs  → current declared inputs (defaults when never set)
 * POST /api/v1/me/inputs  → { cash_on_hand_taka?, income_day?, rent_amount_taka?,
 *                             rent_confirmed?, other_liquid_taka? }
 *
 * A declared cash amount is authoritative for DECLARATION_TTL_DAYS and decays
 * forward at the observed daily cash burn, so it can never permanently
 * overstate liquidity. The user_id comes ONLY from the verified token.
 */
export async function GET(req: NextRequest) {
  try {
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();
    const { txns } = await personaTxns(user.id);
    const inputs = await getUserInputs(user.id);
    const anchor = new Date();
    const eff = effectiveCashOnHand(txns, anchor, inputs.cashOnHandTaka, inputs.cashOnHandUpdatedAt);

    const data = {
      cash_on_hand_taka: inputs.cashOnHandTaka,
      cash_on_hand_updated_at: inputs.cashOnHandUpdatedAt?.toISOString() ?? null,
      income_day: inputs.incomeDay,
      rent_amount_taka: inputs.rentAmountTaka,
      rent_confirmed: inputs.rentConfirmed,
      other_liquid_taka: inputs.otherLiquidTaka,
      updated_at: inputs.updatedAt?.toISOString() ?? null,
      // Effective values actually used by the engines right now:
      effective_cash_on_hand_taka: eff.cashTaka,
      effective_cash_on_hand_display: formatTaka(eff.cashTaka, "bn"),
      cash_source: eff.source,
    };
    const evidence = buildEvidence({
      nTransactions: txns.length,
      windowStart: txns.length ? txns[0].timestamp.slice(0, 10) : anchor.toISOString().slice(0, 10),
      asOfDate: anchor.toISOString().slice(0, 10),
      labels: { user_inputs: "Data", effective_cash_on_hand: "Data" },
      forecastVersion: MODEL_VERSION,
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 inputs GET]", e);
    return notFound("Inputs failed");
  }
}

export async function POST(req: NextRequest) {
  try {
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();

    const body = (await req.json().catch(() => null)) as {
      cash_on_hand_taka?: number;
      income_day?: number;
      rent_amount_taka?: number;
      rent_confirmed?: boolean;
      other_liquid_taka?: number;
    } | null;
    if (!body) return badRequest("JSON body required");

    const int = (v: unknown, lo: number, hi: number, name: string): number | undefined => {
      if (v === undefined || v === null) return undefined;
      const n = Number(v);
      if (!Number.isInteger(n) || n < lo || n > hi) throw new RangeError(`${name} must be an integer in [${lo}, ${hi}]`);
      return n;
    };

    let patch: Parameters<typeof upsertUserInputs>[1];
    try {
      patch = {
        cashOnHandTaka: int(body.cash_on_hand_taka, 0, 10_000_000, "cash_on_hand_taka"),
        incomeDay: int(body.income_day, 1, 31, "income_day"),
        rentAmountTaka: int(body.rent_amount_taka, 0, 10_000_000, "rent_amount_taka"),
        rentConfirmed: typeof body.rent_confirmed === "boolean" ? body.rent_confirmed : undefined,
        otherLiquidTaka: int(body.other_liquid_taka, 0, 10_000_000, "other_liquid_taka"),
      };
    } catch (err) {
      return badRequest((err as Error).message);
    }
    if (Object.values(patch).every((v) => v === undefined)) {
      return badRequest("Provide at least one input field");
    }

    const saved = await upsertUserInputs(user.id, patch);
    const { txns } = await personaTxns(user.id);
    const anchor = new Date();
    const eff = effectiveCashOnHand(txns, anchor, saved.cashOnHandTaka, saved.cashOnHandUpdatedAt);

    const data = {
      cash_on_hand_taka: saved.cashOnHandTaka,
      cash_on_hand_updated_at: saved.cashOnHandUpdatedAt?.toISOString() ?? null,
      income_day: saved.incomeDay,
      rent_amount_taka: saved.rentAmountTaka,
      rent_confirmed: saved.rentConfirmed,
      other_liquid_taka: saved.otherLiquidTaka,
      updated_at: saved.updatedAt?.toISOString() ?? null,
      effective_cash_on_hand_taka: eff.cashTaka,
      effective_cash_on_hand_display: formatTaka(eff.cashTaka, "bn"),
      cash_source: eff.source,
    };
    const evidence = buildEvidence({
      nTransactions: txns.length,
      windowStart: txns.length ? txns[0].timestamp.slice(0, 10) : anchor.toISOString().slice(0, 10),
      asOfDate: anchor.toISOString().slice(0, 10),
      labels: { user_inputs: "Data", effective_cash_on_hand: "Data", declaration_decay: "Assumption" },
      forecastVersion: MODEL_VERSION,
      extraAssumptions: [
        { id: "CASH_DECLARATION_TTL_DAYS", value: "14", label: "Days a user cash declaration stays authoritative" },
      ],
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 inputs POST]", e);
    return notFound("Inputs failed");
  }
}
