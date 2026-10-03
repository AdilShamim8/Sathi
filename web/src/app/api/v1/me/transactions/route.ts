import { NextRequest } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, buildEvidence, ok, unauthorized, notFound,
} from "@/lib/server/sathiApi";
import { categorize, SATHI_CATEGORY_LABELS } from "@/lib/engine/categorizer";
import { formatTaka } from "@/lib/engine/formatting";
import { dhakaYmd } from "@/lib/engine/timeutils";

export const dynamic = "force-dynamic";

/**
 * Transaction list with per-txn reason trace (reference: GET /v1/me/transactions).
 */
export async function GET(req: NextRequest) {
  try {
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();
    const { txns } = await personaTxns(user.id);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

    const items = txns.slice().reverse().slice(offset, offset + limit).map((t) => {
      const cat = categorize(t);
      const { y, m, d } = dhakaYmd(t.timestamp);
      return {
        txn_id: `tx-${t.id}`,
        date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        type: t.direction === "in" ? (t.category === "income" ? "salary_in" : "cash_in") : t.category === "cash_out" ? "cash_out" : "payment",
        amount_paisa: t.amount * 100,
        amount_display: formatTaka(t.amount, "bn"),
        counterparty: t.merchant,
        channel: t.channel,
        category: cat.category,
        category_label_bn: SATHI_CATEGORY_LABELS[cat.category].bn,
        category_label_en: SATHI_CATEGORY_LABELS[cat.category].en,
        rule_id: cat.ruleId,
        reason_bn: cat.reasonBn,
        reason_en: cat.reasonEn,
      };
    });

    const data = {
      n_transactions: txns.length,
      limit,
      offset,
      transactions: items,
    };
    const evidence = buildEvidence({
      nTransactions: txns.length,
      windowStart: txns.length ? txns[0].timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10),
      asOfDate: new Date().toISOString().slice(0, 10),
      labels: { transactions: "Data", categorization: "Data (rule trace)" },
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 transactions]", e);
    return notFound("Transactions failed");
  }
}

