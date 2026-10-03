import { NextRequest } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, buildEvidence, ok, unauthorized, notFound,
} from "@/lib/server/sathiApi";
import { personaActions } from "@/lib/server/personaActions";
import { formatTaka } from "@/lib/engine/formatting";
import { MODEL_VERSION } from "@/lib/engine/domain";

export const dynamic = "force-dynamic";

/**
 * Counterfactual actions (mission P1): GET /api/v1/me/actions.
 *
 * Ranks candidate actions by the estimated reduction in 7-day shortfall
 * probability, recomputed over the SAME simulated liquidity paths that
 * produced the baseline forecast. Suggestions, never instructions — the
 * system never moves money.
 */
export async function GET(req: NextRequest) {
  try {
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();
    const { txns } = await personaTxns(user.id);

    const { actions, base } = personaActions(user, txns);

    const data = {
      actions: actions.map((a) => ({
        ...a,
        safe_to_spend_after_display: formatTaka(a.safe_to_spend_after_taka, "bn"),
      })),
      base_shortfall_prob: base ? Math.round(base.pShortfall * 10000) / 10000 : 0,
      base_safe_to_spend_paisa: base ? base.safeToSpendPaisa : null,
      method: base
        ? `counterfactual over the same simulated paths (${base.method})`
        : "none — no transaction history",
      note_bn: "প্রতিটি বিকল্প একই সিমুলেশন পথে পুনঃগণনা করা — সুপারিশ, নির্দেশ নয়।",
      note_en: "Each option re-runs the same simulated paths — a suggestion, never an instruction.",
    };
    const evidence = buildEvidence({
      nTransactions: txns.length,
      windowStart: txns.length ? txns[0].timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10),
      asOfDate: new Date().toISOString().slice(0, 10),
      labels: {
        actions: "Prediction",
        delta_shortfall_prob: "Prediction",
        fee_savings: "Assumption-based estimate",
      },
      forecastVersion: MODEL_VERSION,
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 actions]", e);
    return notFound("Actions failed");
  }
}
