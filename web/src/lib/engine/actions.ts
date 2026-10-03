/**
 * P1 — Actions & Simulation.
 * 2–3 concrete actions with simulated impact on cash flow, shortfall risk
 * and goals. Options are presented with trade-offs — never commanded.
 */
import type { ActionCard, Goal, Txn, SpendingIntelligence, ShortfallRiskResult, SafeToSpendResult } from "./domain";
import { categoryLabel } from "./domain";
import { estimateMonthlyCapacity } from "./analytics";
import { cashoutFee } from "./cashout";
import { simulateGoal } from "./goals";
import { calculateSafeToSpend, upcomingCommitments } from "./safeToSpend";

export function buildActionCards(params: {
  txns: Txn[];
  anchor: Date;
  intel: SpendingIntelligence;
  risk: ShortfallRiskResult;
  sts: SafeToSpendResult;
  activeGoal: Goal | null;
}): ActionCard[] {
  const { txns, anchor, intel, risk, sts, activeGoal } = params;
  const { capacity } = estimateMonthlyCapacity(txns, anchor);
  const cards: ActionCard[] = [];

  const projRisk = (freedMonthly: number) => {
    // deterministic sensitivity: risk falls with extra liquidity headroom.
    // We approximate by re-running safe-to-spend with 7/30 of freed amount
    // added to the balance and mapping status → probability adjustment.
    const addedLiquidity = (freedMonthly * 7) / 30;
    const sim = calculateSafeToSpend({
      walletBalance: sts.walletBalance + addedLiquidity,
      upcomingCommitments: sts.upcomingCommitments,
      dailyEssentials: Math.max(200, Math.round(intel.dailyEssentials - freedMonthly / 30)),
      horizonDays: 7,
      monthlySavingsTarget: Math.round(capacity * 0.3),
    });
    // map safe-to-spend status to a probability delta (transparent heuristic)
    const headroom = sim.safeToSpendTotal - sts.safeToSpendTotal;
    const delta = Math.min(0.35, headroom / Math.max(1, sts.walletBalance) * 0.5);
    // floor at a small epsilon but never ABOVE the current risk — an action
    // must not preview as making things worse through rounding
    const floor = Math.min(risk.probability, 0.02);
    return Math.max(floor, Math.round((risk.probability - delta) * 100) / 100);
  };

  // Action 1 — hold a buffer on salary day (pay-yourself-first)
  {
    const freed = Math.max(500, Math.round(capacity * 0.2));
    const sim = activeGoal
      ? simulateGoal({ goal: activeGoal, txns, anchor, extraMonthlySavings: freed })
      : null;
    cards.push({
      id: "buffer_payday",
      titleEn: "Hold a buffer on salary day",
      titleBn: "বেতনের দিন একটি বাফার রাখুন",
      description: `Set aside ${fmt(freed)} right when your salary arrives — before discretionary spending starts — to protect days 21–31.`,
      rationale: "Your history shows a repeating dry spell before payday: spending continues in the last 10 days while no income arrives. A payday buffer is the standard mitigation.",
      category: "cashflow",
      simulated: {
        freedMonthly: freed,
        shortfallProbBefore: risk.probability,
        shortfallProbAfter: projRisk(freed),
        safeToSpendAfter: Math.round(sts.safeToSpendTotal + (freed * 7) / 30),
        goalMonthsSaved: sim?.monthsSaved ?? null,
        goalGapAfter: sim?.projectedGap ?? null,
      },
      tradeoff: `Your flexible spending during the month drops by about ${fmt(freed)}.`,
    });
  }

  // Action 2 — trim the top discretionary category 20%
  {
    const disc = intel.categories.find((c) =>
      ["food_beverage", "shopping", "entertainment"].includes(c.category) && c.thisMonth > 0,
    );
    if (disc) {
      const freed = Math.round((disc.thisMonth * 0.2));
      const sim = activeGoal
        ? simulateGoal({ goal: activeGoal, txns, anchor, cutCategory: disc.category, cutPct: 20 })
        : null;
      cards.push({
        id: "trim_discretionary",
        titleEn: `Trim ${disc.labelEn} by 20%`,
        titleBn: `${disc.labelBn} ২০% কমান`,
        description: `You spent ${fmt(disc.thisMonth)} on ${disc.labelEn.toLowerCase()} in the last 30 days. A 20% trim frees about ${fmt(freed)} per month.`,
        rationale: `Discretionary categories are where trade-offs are easiest: this one is ${Math.round(disc.share)}% of your outflow across ${disc.txCount} transactions.`,
        category: "habits",
        simulated: {
          freedMonthly: freed,
          shortfallProbBefore: risk.probability,
          shortfallProbAfter: projRisk(freed),
          safeToSpendAfter: Math.round(sts.safeToSpendTotal + (freed * 7) / 30),
          goalMonthsSaved: sim?.monthsSaved ?? null,
          goalGapAfter: sim?.projectedGap ?? null,
        },
        tradeoff: `About ${fmt(Math.round(disc.avgAmount))} less per ${categoryLabel(disc.category).toLowerCase()} transaction, or ${Math.max(1, Math.round(disc.txCount * 0.2))} fewer purchases a month.`,
      });
    }
  }

  // Action 3 — batch cash-outs to cut fee leakage
  if (intel.cashOut.count >= 3) {
    // Tariff-grounded saving (config/fees.yaml: 1.5% with a ৳5 minimum):
    // batching N withdrawals into 2 keeps only 2 fees on the same total.
    const avgAmount = Math.round(intel.cashOut.total / intel.cashOut.count);
    const feeNow = intel.cashOut.count * cashoutFee(avgAmount);
    const freed = Math.max(0, feeNow - 2 * cashoutFee(Math.round(intel.cashOut.total / 2)));
    const sim = activeGoal
      ? simulateGoal({ goal: activeGoal, txns, anchor, extraMonthlySavings: freed })
      : null;
    if (freed >= 5) {
      cards.push({
        id: "batch_cashouts",
        titleEn: "Batch your cash-outs",
        titleBn: "ক্যাশ-আউট একত্র করুন",
        description: `You cashed out ${intel.cashOut.count} times (${fmt(intel.cashOut.total)}) in 30 days. Batching into 1–2 larger withdrawals saves repeated fees — roughly ${fmt(freed)} a month.`,
        rationale: `Each agent cash-out carries ${fmt(cashoutFee(avgAmount))} at the illustrative tariff; fewer, larger withdrawals pay fewer minimums.`,
        category: "cashflow",
        simulated: {
          freedMonthly: freed,
          shortfallProbBefore: risk.probability,
          shortfallProbAfter: projRisk(freed),
          safeToSpendAfter: Math.round(sts.safeToSpendTotal + (freed * 7) / 30),
          goalMonthsSaved: sim?.monthsSaved ?? null,
          goalGapAfter: sim?.projectedGap ?? null,
        },
        tradeoff: "You carry a bit more cash at once — plan the withdrawal around your weekly bazar run.",
      });
    }
  }

  return cards;
}

function fmt(n: number): string {
  return `৳${Math.round(n).toLocaleString()}`;
}
