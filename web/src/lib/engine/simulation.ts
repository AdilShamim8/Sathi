/**
 * Balance path simulation — ported from Sathi core/simulation.py.
 *
 * Blocks (not independent daily draws) keep day-to-day correlation; sampling
 * each day independently from quantiles would understate cumulative variance
 * and make P(shortfall) too optimistic (reference architecture §6.1).
 *
 * This is the engine behind "Shortfall risk in the next N days": it produces
 * a calibrated probability, the median trough day, and per-day quantiles.
 * Pure: the caller passes history and the RNG.
 */

import { mulberry32 } from "./rng";

/**
 * Seeded stationary block bootstrap of daily net-flow residuals.
 *
 * @param residuals      daily net flow residuals (taka), history order
 * @param startBalance   balance at the forecast origin (taka)
 * @param horizonDays    days ahead to simulate
 * @param blockLengthDays block size preserving autocorrelation
 * @param nPaths         number of simulated paths
 * @param seed           RNG seed (deterministic output)
 * @returns paths[path][day] — shape (nPaths, horizonDays+1); column 0 is the
 *          start balance, column i is the balance at the end of day i.
 */
export function simulateBalancePaths(params: {
  residuals: number[];
  startBalance: number;
  horizonDays: number;
  blockLengthDays: number;
  nPaths: number;
  seed: number;
}): number[][] {
  const { residuals: residualsIn, startBalance, horizonDays, blockLengthDays, nPaths, seed } = params;
  if (horizonDays <= 0 || nPaths <= 0) {
    return [[startBalance]];
  }
  let residuals = residualsIn;
  if (residuals.length < blockLengthDays) {
    // Too little history: repeat what exists. Callers mark confidence low.
    const grown: number[] = [];
    while (grown.length < Math.max(blockLengthDays, 1)) {
      grown.push(...(residuals.length ? residuals : [0]));
    }
    residuals = grown;
  }

  const rand = mulberry32(seed);
  const nBlocks = Math.ceil(horizonDays / blockLengthDays);
  const maxStart = residuals.length - blockLengthDays;

  const paths: number[][] = [];
  for (let p = 0; p < nPaths; p++) {
    const flows: number[] = [];
    for (let b = 0; b < nBlocks; b++) {
      const start = Math.floor(rand() * (maxStart + 1));
      for (let i = 0; i < blockLengthDays; i++) flows.push(residuals[start + i]);
    }
    const path = new Array<number>(horizonDays + 1);
    path[0] = startBalance;
    let bal = startBalance;
    for (let d = 0; d < horizonDays; d++) {
      bal += flows[d];
      path[d + 1] = bal;
    }
    paths.push(path);
  }
  return paths;
}

export interface ShortfallStats {
  /** P(balance dips below the essentials threshold within daysToIncome). */
  pShortfall: number;
  /** Median day offset of the trough (1-based: day 1 = tomorrow); null if no window. */
  medianTroughDay: number | null;
  /** Minimum balance reached within the window, per path. */
  minBalances: number[];
}

export function shortfallStats(
  paths: number[][],
  essentialsThreshold: number,
  daysToIncome: number,
): ShortfallStats {
  const windowLen = daysToIncome >= 1 ? Math.min(daysToIncome, paths[0].length - 1) : paths[0].length - 1;
  if (windowLen <= 0) {
    return { pShortfall: 0, medianTroughDay: null, minBalances: paths.map((p) => p[p.length - 1]) };
  }
  const minBalances: number[] = [];
  const troughDays: number[] = [];
  for (const path of paths) {
    let min = Infinity;
    let minDay = 1;
    for (let d = 1; d <= windowLen; d++) {
      if (path[d] < min) {
        min = path[d];
        minDay = d;
      }
    }
    minBalances.push(min);
    troughDays.push(minDay);
  }
  const shortfallCount = minBalances.filter((b) => b < essentialsThreshold).length;
  const medianTroughDay = median(troughDays);
  return {
    pShortfall: shortfallCount / paths.length,
    medianTroughDay,
    minBalances,
  };
}

/** Linear-interpolated percentile of a numeric sample (like numpy percentile). */
export function percentile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function median(values: number[]): number {
  return percentile(values, 50);
}

/** Daily balance quantiles from simulated paths: q10/q50/q90 per future day. */
export function dailyQuantiles(
  paths: number[][],
): { dayIndex: number; p10: number; p50: number; p90: number }[] {
  if (paths.length === 0) return [];
  const horizon = paths[0].length - 1;
  const out: { dayIndex: number; p10: number; p50: number; p90: number }[] = [];
  for (let d = 1; d <= horizon; d++) {
    const col = paths.map((p) => p[d]);
    out.push({
      dayIndex: d,
      p10: Math.round(percentile(col, 10)),
      p50: Math.round(percentile(col, 50)),
      p90: Math.round(percentile(col, 90)),
    });
  }
  return out;
}
