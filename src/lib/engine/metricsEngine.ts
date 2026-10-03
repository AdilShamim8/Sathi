/**
 * Metrics engine — ported from Sathi core/metrics.py.
 *
 * Definitions (the engine computes these, the LLM never does):
 *   savings_rate           = (income - spending) / income
 *   income_volatility      = CV of monthly inflow (normalized per user)
 *   buffer_days            = liquid balance / average daily essential spend
 *   cash_dependency_ratio  = cash-out value / total outflow
 *   fee_leakage            = total fees / total spending
 *   fixed_commitment_ratio = recurring obligations / income
 *
 * Amounts are whole taka. Pure functions over categorized transactions.
 */

import type { Txn } from "./domain";
import { dhakaYmd, isoWeek } from "./timeutils";
import { cashoutFee } from "./cashout";

/** Categories the user cannot pause — used for buffer-days and the planner cap. */
export const ESSENTIAL_CATEGORIES = new Set([
  "food_beverage", "groceries", "transport", "utilities", "mobile_topup", "health",
]);

/** Recurring obligations for the fixed-commitment ratio. */
export const OBLIGATION_CATEGORIES = new Set([
  "housing", "utilities", "mobile_topup", "send_money",
]);

export interface MetricsBundle {
  monthlyIncome: number;
  monthlySpend: number;
  savingsRate: number | null; // null when income is zero
  incomeVolatility: number | null; // CV of monthly inflows
  bufferDays: number | null; // null when no essential spend seen
  cashDependencyRatio: number | null;
  feeLeakage: number | null;
  fixedCommitmentRatio: number | null;
  nTransactions: number;
  windowDays: number;
}

export interface MonthKey {
  y: number;
  m: number;
}

/** (year, month) → { inflow, outflow } over the Dhaka calendar. */
export function monthlyTotals(txns: Txn[]): Map<string, { y: number; m: number; inflow: number; outflow: number }> {
  const totals = new Map<string, { y: number; m: number; inflow: number; outflow: number }>();
  for (const t of txns) {
    const { y, m } = dhakaYmd(t.timestamp);
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const slot = totals.get(key) ?? { y, m, inflow: 0, outflow: 0 };
    const fee = t.direction === "out" && t.category === "cash_out" ? cashoutFee(t.amount) : 0;
    if (t.direction === "in") slot.inflow += t.amount;
    else slot.outflow += t.amount + fee;
    totals.set(key, slot);
  }
  return totals;
}

function pstdev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeMetrics(
  txns: Txn[],
  balance: number,
  essentialsPerDay: number,
): MetricsBundle {
  const n = txns.length;
  if (n === 0) {
    return {
      monthlyIncome: 0, monthlySpend: 0, savingsRate: null, incomeVolatility: null,
      bufferDays: null, cashDependencyRatio: null, feeLeakage: null,
      fixedCommitmentRatio: null, nTransactions: 0, windowDays: 0,
    };
  }

  const dates = txns.map((t) => {
    const { y, m, d } = dhakaYmd(t.timestamp);
    return new Date(Date.UTC(y, m - 1, d));
  });
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const windowDays = Math.max(Math.round((max.getTime() - min.getTime()) / (24 * 3600 * 1000)) + 1, 1);
  const months = Math.max(windowDays / 30.4375, 1e-9);

  const inflow = txns.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const outflows = txns.filter((t) => t.direction === "out");
  const outflow = outflows.reduce((s, t) => s + t.amount + (t.category === "cash_out" ? cashoutFee(t.amount) : 0), 0);
  const fees = outflows.reduce((s, t) => s + (t.category === "cash_out" ? cashoutFee(t.amount) : 0), 0);
  const cashout = outflows
    .filter((t) => t.category === "cash_out")
    .reduce((s, t) => s + t.amount + cashoutFee(t.amount), 0);
  const obligations = outflows
    .filter((t) => OBLIGATION_CATEGORIES.has(t.category))
    .reduce((s, t) => s + t.amount, 0);
  const essentialSpend = outflows
    .filter((t) => ESSENTIAL_CATEGORIES.has(t.category))
    .reduce((s, t) => s + t.amount, 0);

  const savingsRate = inflow > 0 ? (inflow - outflow) / inflow : null;
  const monthlyIn = [...monthlyTotals(txns).values()].map((v) => v.inflow);
  const meanIn = monthlyIn.length ? monthlyIn.reduce((s, v) => s + v, 0) / monthlyIn.length : 0;
  const incomeVolatility =
    monthlyIn.length > 1 && meanIn > 0 ? pstdev(monthlyIn) / meanIn : null;

  const avgDailyEssential = essentialSpend / windowDays;
  // Buffer uses the larger of observed essential spend and the configured
  // threshold so a low-activity user does not look falsely safe.
  const divisor = Math.max(avgDailyEssential, essentialsPerDay);
  const bufferDays = divisor > 0 ? balance / divisor : null;

  const monthlyIncome = Math.floor(inflow / months);
  const fixedRatio = monthlyIncome > 0 ? obligations / months / monthlyIncome : null;

  return {
    monthlyIncome,
    monthlySpend: Math.floor(outflow / months),
    savingsRate,
    incomeVolatility,
    bufferDays,
    cashDependencyRatio: outflow > 0 ? cashout / outflow : null,
    feeLeakage: outflow > 0 ? fees / outflow : null,
    fixedCommitmentRatio: fixedRatio,
    nTransactions: n,
    windowDays,
  };
}

export interface WeekOutflow {
  isoYear: number;
  isoWeek: number;
  start: string; // ISO date of the week's Monday
  outflow: number;
  isLargest: boolean;
}

/** Outflow grouped by ISO week, largest week flagged (not by colour alone). */
export function weeklyOutflows(txns: Txn[]): WeekOutflow[] {
  const weeks = new Map<string, { isoYear: number; isoWeek: number; monday: Date; outflow: number }>();
  for (const t of txns) {
    if (t.direction === "in") continue;
    const { year, week } = isoWeek(t.timestamp);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const { y, m, d } = dhakaYmd(t.timestamp);
    const date = new Date(Date.UTC(y, m - 1, d));
    const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    const monday = new Date(date.getTime() - (weekday - 1) * 24 * 3600 * 1000);
    const fee = t.category === "cash_out" ? cashoutFee(t.amount) : 0;
    const slot = weeks.get(key) ?? { isoYear: year, isoWeek: week, monday, outflow: 0 };
    slot.outflow += t.amount + fee;
    weeks.set(key, slot);
  }
  if (weeks.size === 0) return [];
  const largest = Math.max(...[...weeks.values()].map((w) => w.outflow));
  return [...weeks.values()]
    .sort((a, b) => a.monday.getTime() - b.monday.getTime())
    .map((w) => ({
      isoYear: w.isoYear,
      isoWeek: w.isoWeek,
      start: w.monday.toISOString().slice(0, 10),
      outflow: w.outflow,
      isLargest: w.outflow === largest,
    }));
}
