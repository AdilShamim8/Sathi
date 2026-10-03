/**
 * Generate the offline demo bundles at public/demo/ — the same contract as
 * the reference web app's /demo/{persona}.json files. The bundles let the
 * web shell render every screen with zero backend (offline fallback), and
 * give reviewers a static, inspectable snapshot of each persona's state.
 *
 * Run: bun run scripts/generate-demo-bundles.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { demoUsers, generateSathiPersonaHistory, SATHI_PERSONAS } from "../src/lib/engine/sathiPersonas";
import { computeMetrics, monthlyTotals, weeklyOutflows } from "../src/lib/engine/metricsEngine";
import { calculateSafeToSpend, upcomingCommitments } from "../src/lib/engine/safeToSpend";
import { detectRecurring, estimateCashOnHand } from "../src/lib/engine/analytics";
import { categorize } from "../src/lib/engine/categorizer";
import { detectCashoutPatterns, cashoutFee } from "../src/lib/engine/cashout";
import { simulateBalancePaths, shortfallStats, dailyQuantiles } from "../src/lib/engine/simulation";
import { planGoal } from "../src/lib/engine/planner";
import { formatTaka, formatProbability } from "../src/lib/engine/formatting";
import {
  ESSENTIALS_PER_DAY_TAKA, THRESHOLDS, SIMULATION_CONFIG, PLANNER_CONFIG, bandRisk,
} from "../src/lib/engine/sathiConfig";
import type { Txn } from "../src/lib/engine/domain";

const OUT_DIR = join(process.cwd(), "public", "demo");
mkdirSync(OUT_DIR, { recursive: true });

const anchor = new Date();

function toTxns(raw: ReturnType<typeof generateSathiPersonaHistory>["txns"]): Txn[] {
  return raw.map((t, i) => ({
    id: i,
    timestamp: t.timestamp.toISOString(),
    amount: t.amount,
    currency: t.currency,
    direction: t.direction,
    category: t.category,
    subcategory: t.subcategory,
    merchant: t.merchant,
    channel: t.channel,
    source: t.source,
    classificationConfidence: t.classificationConfidence,
  }));
}

/* users.json */
writeFileSync(join(OUT_DIR, "users.json"), JSON.stringify(demoUsers(), null, 2));
console.log("✓ users.json");

/* per-persona bundle seeds: hand-picked representative states
 * (garment worker: mid-dry-spell with a watch-band risk story) */
const BUNDLE_SEEDS: Record<string, number> = {
  garment_worker: 42,
  gig_driver: 20260121,
  remittance_household: 20260132,
  shopkeeper: 20260112,
  student: 20260108,
};

/* per-persona bundles */
for (const [personaId, spec] of Object.entries(SATHI_PERSONAS)) {
  const { txns: raw, openingBalance } = generateSathiPersonaHistory(
    personaId, anchor, BUNDLE_SEEDS[personaId] ?? 42,
  );
  const txns = toTxns(raw);
  const salary = personaId === "garment_worker" ? { amount: 18000, payDay: 7 } : { amount: null, payDay: null };

  const cash = estimateCashOnHand(txns, anchor, openingBalance, salary);
  const metrics = computeMetrics(txns, cash.walletBalance, ESSENTIALS_PER_DAY_TAKA);
  const recurring = detectRecurring(txns);
  const recurringOut = recurring.filter((r) => r.direction === "out");
  const recurringIn = recurring.filter((r) => r.direction === "in");
  const commitments14 = upcomingCommitments(recurringOut, anchor, 14);
  const confidence =
    metrics.nTransactions < THRESHOLDS.min_history_transactions ||
    metrics.windowDays < THRESHOLDS.min_history_days
      ? "low"
      : "normal";

  const s2s = calculateSafeToSpend({
    walletBalance: cash.walletBalance,
    upcomingCommitments: commitments14,
    dailyEssentials: Math.max(ESSENTIALS_PER_DAY_TAKA, Math.round(metrics.monthlySpend / 30)),
    horizonDays: 14,
    monthlySavingsTarget: 0,
  });

  // forecast: block bootstrap
  const dailyNets = new Map<string, number>();
  for (const t of txns) {
    const key = t.timestamp.slice(0, 10);
    dailyNets.set(key, (dailyNets.get(key) ?? 0) + (t.direction === "in" ? t.amount : -t.amount));
  }
  const sortedKeys = [...dailyNets.keys()].sort();
  const horizon = THRESHOLDS.shortfall_horizon_days;
  const paths = simulateBalancePaths({
    residuals: sortedKeys.length ? sortedKeys.map((k) => dailyNets.get(k)!) : [-ESSENTIALS_PER_DAY_TAKA],
    startBalance: cash.walletBalance,
    horizonDays: horizon,
    blockLengthDays: SIMULATION_CONFIG.block_length_days,
    nPaths: SIMULATION_CONFIG.n_paths,
    seed: 20261003,
  });
  const { pShortfall, medianTroughDay } = shortfallStats(
    paths, ESSENTIALS_PER_DAY_TAKA, Math.min(cash.daysToNextIncome ?? horizon, horizon),
  );

  // cashout audit
  const window90 = txns.filter((t) => new Date(t.timestamp).getTime() > anchor.getTime() - 90 * 24 * 3600 * 1000);
  const cashout = detectCashoutPatterns(window90);

  // goal plan (default: 3 months of income as emergency fund target, 6 months)
  const totals = [...monthlyTotals(txns).values()];
  const surplusSamples = totals.map((v) => v.inflow - v.outflow);
  const inflowSamples = totals.map((v) => v.inflow);
  const monthlyFee = Math.round(
    txns.filter((t) => t.direction === "out" && t.category === "cash_out")
      .reduce((s, t) => s + cashoutFee(t.amount), 0) / Math.max(totals.length, 1),
  );
  const plan = planGoal({
    target: Math.max(5000, Math.round(metrics.monthlyIncome * 3)),
    months: 6,
    monthlySurplusSamples: surplusSamples.length ? surplusSamples : [500],
    monthlyInflowSamples: inflowSamples.length ? inflowSamples : [2500],
    monthlyFeeLeakage: monthlyFee,
    monthlyAvoidable: Math.round(monthlyFee / 2),
    maxSafeContribution: Math.max(
      Math.round((surplusSamples.length ? surplusSamples.reduce((s, v) => s + v, 0) / surplusSamples.length : 500)),
      THRESHOLDS.min_goal_monthly_contribution_paisa / 100,
    ),
    config: {
      nSimulations: PLANNER_CONFIG.n_simulations,
      horizonCapMonths: PLANNER_CONFIG.horizon_cap_months,
      minMonthlyContribution: THRESHOLDS.min_goal_monthly_contribution_paisa / 100,
      likelyCutoff: PLANNER_CONFIG.likely_cutoff,
      uncertainCutoff: PLANNER_CONFIG.uncertain_cutoff,
    },
    seed: PLANNER_CONFIG.seed,
    asOfDate: anchor,
  });

  const bundle = {
    generated_at: anchor.toISOString(),
    persona: personaId,
    persona_label_bn: spec.labelBn,
    persona_label_en: spec.labelEn,
    n_transactions: txns.length,
    confidence,
    balance: cash.walletBalance,
    balance_display: formatTaka(cash.walletBalance, "bn"),
    safe_to_spend: {
      total: s2s.safeToSpendTotal,
      total_display: formatTaka(s2s.safeToSpendTotal, "bn"),
      daily_budget: s2s.dailySafeBudget,
      daily_budget_display: formatTaka(s2s.dailySafeBudget, "bn"),
      status: s2s.status,
      status_label_bn: s2s.statusLabelBn,
      status_label_en: s2s.statusLabelEn,
      advice_bn: s2s.adviceBn,
      advice_en: s2s.adviceEn,
    },
    metrics: {
      monthly_income: metrics.monthlyIncome,
      monthly_income_display: formatTaka(metrics.monthlyIncome, "bn"),
      monthly_spend: metrics.monthlySpend,
      monthly_spend_display: formatTaka(metrics.monthlySpend, "bn"),
      savings_rate: metrics.savingsRate,
      income_volatility: metrics.incomeVolatility,
      buffer_days: metrics.bufferDays,
      cash_dependency_ratio: metrics.cashDependencyRatio,
      fee_leakage: metrics.feeLeakage,
      fixed_commitment_ratio: metrics.fixedCommitmentRatio,
    },
    recurring: {
      inflows: recurringIn.map((r) => ({ label: r.label, amount: r.avgAmount, cadence: r.cadence, dom: r.typicalDayOfMonth })),
      outflows: recurringOut.slice(0, 12).map((r) => ({ label: r.label, amount: r.avgAmount, cadence: r.cadence, dom: r.typicalDayOfMonth })),
      upcoming_commitments_14d: commitments14,
    },
    forecast: {
      horizon_days: horizon,
      shortfall_prob: pShortfall,
      shortfall_prob_display: formatProbability(pShortfall, "bn"),
      risk_level: bandRisk(pShortfall),
      trough_day_offset: medianTroughDay,
      days_to_next_income: cash.daysToNextIncome,
      next_income_date: cash.nextIncomeDate,
      daily_quantiles: dailyQuantiles(paths).map((q) => ({ d: q.dayIndex, p10: q.p10, p50: q.p50, p90: q.p90 })),
    },
    cashout_audit: {
      total_cashouts: cashout.totalCashouts,
      total_fees: cashout.totalFees,
      replaceable_count: cashout.replaceableCount,
      replaceable_fee_saved: cashout.replaceableFeeSaved,
      annualized_savings: Math.round(cashout.replaceableFeeSaved * (365 / 90)),
      patterns: cashout.patterns.map((p) => ({ agent: p.agentId, count: p.count, fee_saved: p.replaceableFeeSaved })),
    },
    goal_plan: {
      target: plan.target,
      verdict: plan.verdict,
      p_requested: plan.pRequested,
      feasibility_note_bn: plan.feasibilityNoteBn,
      feasibility_note_en: plan.feasibilityNoteEn,
      options: plan.options.map((o) => ({
        key: o.key,
        monthly_contribution: o.monthlyContribution,
        months: o.months,
        p_goal_met: o.pGoalMet,
        p_low: o.pLow,
        p_high: o.pHigh,
        tradeoff_bn: o.tradeoffBn,
        tradeoff_en: o.tradeoffEn,
      })),
    },
    categories: (() => {
      const totals2 = new Map<string, number>();
      let outSum = 0;
      for (const t of txns) {
        if (t.direction === "in") continue;
        const cat = categorize(t).category;
        const amt = t.amount + (t.category === "cash_out" ? cashoutFee(t.amount) : 0);
        totals2.set(cat, (totals2.get(cat) ?? 0) + amt);
        outSum += amt;
      }
      return [...totals2.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([cat, total]) => ({ category: cat, total, share: outSum ? total / outSum : 0 }));
    })(),
    weekly_outflows: weeklyOutflows(txns).slice(-8),
  };

  writeFileSync(join(OUT_DIR, `${personaId}.json`), JSON.stringify(bundle, null, 2));
  console.log(
    `✓ ${personaId}.json  (n=${txns.length}, balance=${formatTaka(cash.walletBalance, "en")}, ` +
    `P(shortfall)=${(pShortfall * 100).toFixed(0)}%, cashout_saved=${formatTaka(cashout.replaceableFeeSaved, "en")})`,
  );
}

console.log("\nDemo bundles written to public/demo/");
