/**
 * Shared compute pipeline: transactions → intelligence → cash-on-hand →
 * risk → safe-to-spend. Used by every API route so the numbers are
 * consistent across screens.
 *
 * Sathi integration: the risk result's trough day / projected trough are
 * refined by the seeded stationary block bootstrap (core/simulation.py
 * port), giving an evidence-backed median trough day instead of a
 * heuristic. Response shapes are unchanged — the UI stays identical.
 */
import type { Txn } from "@/lib/engine/domain";
import {
  computeSpendingIntelligence, estimateCashOnHand, estimateMonthlyCapacity,
} from "@/lib/engine/analytics";
import { forecastCashflow } from "@/lib/engine/forecast";
import { shortfallRisk } from "@/lib/engine/ml";
import { calculateSafeToSpend, upcomingCommitments } from "@/lib/engine/safeToSpend";
import { simulateBalancePaths, shortfallStats } from "@/lib/engine/simulation";
import { SIMULATION_CONFIG, ESSENTIALS_PER_DAY_TAKA } from "@/lib/engine/sathiConfig";

export interface FullComputation {
  intel: ReturnType<typeof computeSpendingIntelligence>;
  cash: ReturnType<typeof estimateCashOnHand>;
  fc: ReturnType<typeof forecastCashflow>;
  risk: ReturnType<typeof shortfallRisk>;
  sts: ReturnType<typeof calculateSafeToSpend>;
  capacity: number;
}

export function computeAll(
  txns: Txn[],
  anchor: Date,
  openingBalance: number,
  salary: { amount: number | null; payDay: number | null },
  horizonDays = 7,
  opts?: { cashOnHand?: number; otherLiquid?: number },
): FullComputation {
  const intel = computeSpendingIntelligence(txns, anchor);
  const cash = estimateCashOnHand(txns, anchor, openingBalance, salary);
  const fc = forecastCashflow(txns, anchor, horizonDays, cash.walletBalance);
  const risk = shortfallRisk(txns, anchor, openingBalance, cash.walletBalance, horizonDays, salary);
  const commitments = upcomingCommitments(intel.recurring, anchor, horizonDays);
  const { capacity } = estimateMonthlyCapacity(txns, anchor);
  const sts = calculateSafeToSpend({
    walletBalance: cash.walletBalance,
    upcomingCommitments: commitments,
    dailyEssentials: cash.dailyEssentials,
    horizonDays,
    monthlySavingsTarget: capacity > 0 ? Math.round(capacity * 0.3) : 0,
    // Mission P0: liquidity = wallet + effective cash-on-hand + other liquid
    // (user-corrected; POST /api/inputs). Risk stays wallet-based (conservative).
    cashOnHand: opts?.cashOnHand ?? 0,
    otherLiquid: opts?.otherLiquid ?? 0,
  });

  // Sathi block bootstrap: refine the trough evidence with a simulated
  // median trough day + projected trough balance (same field names).
  try {
    const dailyNets = new Map<string, number>();
    for (const t of txns) {
      const key = t.timestamp.slice(0, 10);
      dailyNets.set(key, (dailyNets.get(key) ?? 0) + (t.direction === "in" ? t.amount : -t.amount));
    }
    const sortedKeys = [...dailyNets.keys()].sort();
    if (sortedKeys.length) {
      const daySeed = parseInt(anchor.toISOString().slice(0, 10).replace(/-/g, ""), 10);
      const paths = simulateBalancePaths({
        residuals: sortedKeys.map((k) => dailyNets.get(k)!),
        startBalance: cash.walletBalance,
        horizonDays: Math.max(horizonDays, 14),
        blockLengthDays: SIMULATION_CONFIG.block_length_days,
        nPaths: 200, // UI latency budget; the v1 API runs the full 400
        seed: daySeed,
      });
      const stats = shortfallStats(
        paths,
        Math.max(ESSENTIALS_PER_DAY_TAKA, Math.min(cash.dailyEssentials, risk.projectedTrough + ESSENTIALS_PER_DAY_TAKA * 3)),
        Math.min(cash.daysToNextIncome ?? horizonDays, horizonDays),
      );
      if (stats.medianTroughDay !== null) {
        const trough = new Date(anchor.getTime() + stats.medianTroughDay * 24 * 3600 * 1000);
        risk.troughDay = trough.toISOString();
        risk.projectedTrough = Math.round(
          stats.minBalances.reduce((s, b) => s + b, 0) / stats.minBalances.length,
        );
        risk.expectedMinBalance = risk.projectedTrough;
      }
    }
  } catch {
    // Simulation is an enhancement — never let it break the pipeline.
  }

  return { intel, cash, fc, risk, sts, capacity };
}
