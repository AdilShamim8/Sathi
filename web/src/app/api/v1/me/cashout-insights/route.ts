import { NextRequest } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, buildEvidence, ok, unauthorized, notFound,
} from "@/lib/server/sathiApi";
import { detectCashoutPatterns } from "@/lib/engine/cashout";
import { formatTaka } from "@/lib/engine/formatting";

export const dynamic = "force-dynamic";

/**
 * Cash-out fee audit (reference: GET /v1/me/cashout-insights) â€” repeat agent
 * withdrawals that could plausibly have been digital payments, with the fee
 * impact at the configured illustrative rate.
 */
export async function GET(req: NextRequest) {
  try {
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();
    const { txns } = await personaTxns(user.id);

    // Audit the trailing 90 days.
    const anchor = new Date();
    const window = txns.filter(
      (t) => new Date(t.timestamp).getTime() > anchor.getTime() - 90 * 24 * 3600 * 1000,
    );
    const insights = detectCashoutPatterns(window);

    const annualized = Math.round(insights.replaceableFeeSaved * (365 / 90));
    const data = {
      window_days: 90,
      total_cashouts: insights.totalCashouts,
      total_fees_paisa: insights.totalFees * 100,
      total_fees_display: formatTaka(insights.totalFees, "bn"),
      replaceable_count: insights.replaceableCount,
      replaceable_amount_paisa: insights.replaceableAmount * 100,
      replaceable_amount_display: formatTaka(insights.replaceableAmount, "bn"),
      replaceable_fee_saved_paisa: insights.replaceableFeeSaved * 100,
      replaceable_fee_saved_display: formatTaka(insights.replaceableFeeSaved, "bn"),
      annualized_savings_paisa: annualized * 100,
      annualized_savings_display: formatTaka(annualized, "bn"),
      cash_dependency_ratio: insights.cashDependencyRatio,
      patterns: insights.patterns.map((p) => ({
        counterparty_id: p.agentId,
        count: p.count,
        total_amount_paisa: p.totalAmount * 100,
        total_amount_display: formatTaka(p.totalAmount, "bn"),
        total_fee_paisa: p.totalFee * 100,
        total_fee_display: formatTaka(p.totalFee, "bn"),
        replaceable_count: p.replaceableCount,
        replaceable_amount_paisa: p.replaceableAmount * 100,
        replaceable_fee_saved_paisa: p.replaceableFeeSaved * 100,
        replaceable_fee_saved_display: formatTaka(p.replaceableFeeSaved, "bn"),
      })),
    };

    const evidence = buildEvidence({
      nTransactions: window.length,
      windowStart: window.length ? window[0].timestamp.slice(0, 10) : anchor.toISOString().slice(0, 10),
      asOfDate: anchor.toISOString().slice(0, 10),
      labels: {
        total_fees: "Data",
        replaceable: "Data (substitution signal)",
        fee_saved: "Assumption-based estimate",
      },
      extraAssumptions: [
        { id: "CASHOUT_MIN_REPEAT", value: "3", label: "Cash-outs to one agent to count as a habit" },
        { id: "CASHOUT_FOLLOW_DAYS", value: "2", label: "Payment within N days counts as using the cash" },
      ],
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 cashout-insights]", e);
    return notFound("Cashout insights failed");
  }
}

