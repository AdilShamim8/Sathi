/**
 * Cash-out pattern detector — ported from Sathi core/cashout.py.
 *
 * Repeat agent withdrawals that could plausibly have been digital payments,
 * with the fee impact. Replaceability signal: a cash-out followed within
 * `followDays` by a merchant payment of at least `minAmountFrac` of the
 * withdrawn amount. Fee math uses the configurable rate in sathiConfig
 * (shown to the user as a labelled Assumption).
 *
 * Amounts are whole taka. Fees are computed from FEES (150 bps, min ৳5)
 * because this app's synthetic world does not persist per-transaction fees —
 * the same configured rate Sathi's generator charges agents.
 */

import type { Txn } from "./domain";
import { dhakaYmd, daysBetween } from "./timeutils";
import { applyRate } from "./money";
import { FEES, CASHOUT_DETECTOR } from "./sathiConfig";

export interface CashoutPattern {
  agentId: string;
  count: number; // cash-outs to this agent in the window
  totalAmount: number;
  totalFee: number;
  replaceableCount: number; // followed by a digital-capable payment
  replaceableAmount: number;
  replaceableFeeSaved: number; // fees avoidable at the configured rate
}

export interface CashoutInsights {
  patterns: CashoutPattern[];
  totalCashouts: number;
  totalFees: number;
  replaceableCount: number;
  replaceableAmount: number;
  replaceableFeeSaved: number;
  cashDependencyRatio: number | null;
}

/** Cash-out fee for an amount at the configured illustrative rate. */
export function cashoutFee(amount: number): number {
  return applyRate(amount, FEES.cash_out_bps, FEES.cash_out_min_paisa);
}

/** True when the txn is a merchant payment that could have been digital. */
function isDigitalCapablePayment(t: Txn): boolean {
  return (
    t.direction === "out" &&
    t.category !== "cash_out" &&
    t.category !== "send_money" &&
    !!t.merchant
  );
}

function dateKey(t: Txn): Date {
  const { y, m, d } = dhakaYmd(t.timestamp);
  return new Date(Date.UTC(y, m - 1, d));
}

export function detectCashoutPatterns(
  txns: Txn[],
  opts: { minRepeat?: number; followDays?: number; minAmountFrac?: number } = {},
): CashoutInsights {
  const minRepeat = opts.minRepeat ?? CASHOUT_DETECTOR.min_repeat;
  const followDays = opts.followDays ?? CASHOUT_DETECTOR.follow_days;
  const minAmountFrac = opts.minAmountFrac ?? CASHOUT_DETECTOR.min_amount_frac;

  const cashouts = txns.filter((t) => t.direction === "out" && t.category === "cash_out");
  const payments = txns.filter(isDigitalCapablePayment);
  const outflowTotal = txns
    .filter((t) => t.direction === "out")
    .reduce((s, t) => s + t.amount + (t.category === "cash_out" ? cashoutFee(t.amount) : 0), 0);

  // Payment days sorted by date: a payment "uses" the withdrawn cash if it
  // happens within followDays after the withdrawal.
  const paymentIndex = payments
    .map((p) => ({ date: dateKey(p), amount: p.amount }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const replaceable = (co: Txn): boolean => {
    const d = dateKey(co);
    for (const p of paymentIndex) {
      const delta = daysBetween(d, p.date);
      if (delta < 0) continue;
      if (delta > followDays) break;
      if (p.amount >= co.amount * minAmountFrac) return true;
    }
    return false;
  };

  const byAgent = new Map<string, Txn[]>();
  for (const co of cashouts) {
    const id = co.merchant ?? "unknown-agent";
    const arr = byAgent.get(id) ?? [];
    arr.push(co);
    byAgent.set(id, arr);
  }

  const patterns: CashoutPattern[] = [];
  let totalReplaceableCount = 0;
  let totalReplaceableAmount = 0;
  let totalReplaceableFee = 0;
  for (const agentId of [...byAgent.keys()].sort()) {
    const group = byAgent.get(agentId)!;
    if (group.length < minRepeat) continue;
    const rep = group.filter(replaceable);
    const repFee = rep.reduce((s, co) => s + cashoutFee(co.amount), 0);
    patterns.push({
      agentId,
      count: group.length,
      totalAmount: group.reduce((s, co) => s + co.amount, 0),
      totalFee: group.reduce((s, co) => s + cashoutFee(co.amount), 0),
      replaceableCount: rep.length,
      replaceableAmount: rep.reduce((s, co) => s + co.amount, 0),
      replaceableFeeSaved: repFee,
    });
    totalReplaceableCount += rep.length;
    totalReplaceableAmount += rep.reduce((s, co) => s + co.amount, 0);
    totalReplaceableFee += repFee;
  }

  const totalFees = cashouts.reduce((s, co) => s + cashoutFee(co.amount), 0);
  const cashDep =
    outflowTotal > 0
      ? cashouts.reduce((s, co) => s + co.amount + cashoutFee(co.amount), 0) / outflowTotal
      : null;

  return {
    patterns,
    totalCashouts: cashouts.length,
    totalFees,
    replaceableCount: totalReplaceableCount,
    replaceableAmount: totalReplaceableAmount,
    replaceableFeeSaved: totalReplaceableFee,
    cashDependencyRatio: cashDep,
  };
}
