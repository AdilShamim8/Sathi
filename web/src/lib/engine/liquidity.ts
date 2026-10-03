/**
 * Calibrated liquidity-path simulation — port of the additions the ML
 * handoff made to the reference core/simulation.py (commits 7e4f6a0/e091b3a).
 *
 * The forecaster decomposes the daily wallet net flow into
 *   scheduled recurring streams (core/recurring.detect_streams port) +
 *   irregular flow (LightGBM quantile model).
 * This module turns that decomposition into simulated wallet paths:
 *  - inverseCdf: piecewise-linear inverse CDF through predicted quantiles
 *  - blockCorrelatedUniforms: within-block correlated shocks (rho) so bad
 *    days cluster and cumulative risk is not understated
 *  - sampleStreamFlows: per-path stream dates (observed jitter) + amounts
 *  - simulateLiquidityPaths: start + scheduled + irregular, wallet never < 0
 *
 * All money is integer paisa, like the reference. Pure given the RNG.
 */

import type { Stream } from "./recurringStreams";
import { firstOfMonth, monthAnchorDay, type Day } from "./timeutils";

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |err| < 7.5e-8). */
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/** Box-Muller standard normal pair sampler over a uniform RNG. */
function gaussianFactory(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = rand() * 2 - 1;
      v = rand() * 2 - 1;
      s = u * u + v * v;
    } while (s === 0 || s >= 1);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * f;
    return u * f;
  };
}

/**
 * Piecewise-linear inverse CDF through predicted quantiles.
 *
 * quantiles[h] = sorted quantile predictions for day h (length T); taus the
 * matching probabilities; u[p][h] in (0,1). Tails beyond the outer quantiles
 * are extrapolated linearly with the slope of the outermost pair.
 */
export function inverseCdf(
  quantiles: number[][],
  taus: number[],
  u: number[][],
): number[][] {
  const H = quantiles.length;
  const out: number[][] = [];
  for (let h = 0; h < H; h++) {
    const q = [...quantiles[h]!].sort((a, b) => a - b);
    const lo = q[0]! - ((q[1]! - q[0]!) / (taus[1]! - taus[0]!)) * taus[0]!;
    const hi =
      q[q.length - 1]! +
      ((q[q.length - 1]! - q[q.length - 2]!) / (taus[taus.length - 1]! - taus[taus.length - 2]!)) *
        (1 - taus[taus.length - 1]!);
    const gridQ = [lo, ...q, hi];
    const gridT = [0, ...taus, 1];
    const row: number[] = [];
    for (let p = 0; p < u.length; p++) {
      const x = Math.min(Math.max(u[p]![h]!, 1e-9), 1 - 1e-9);
      let i = 0;
      while (i < gridT.length - 2 && x > gridT[i + 1]!) i++;
      const t0 = gridT[i]!;
      const t1 = gridT[i + 1]!;
      const frac = (x - t0) / (t1 - t0);
      row.push(gridQ[i]! + frac * (gridQ[i + 1]! - gridQ[i]!));
    }
    out.push(row);
  }
  // transpose to (P, H) — built per-h above; rows are per-path below
  const P = u.length;
  const res: number[][] = [];
  for (let p = 0; p < P; p++) res.push(out.map((col) => col[p]!));
  return res;
}

/**
 * (P, H) uniforms; days in the same block share a common shock with
 * correlation `rho`, so bad days cluster (cumulative risk is not understated
 * as with independent daily draws).
 */
export function blockCorrelatedUniforms(
  nPaths: number,
  horizon: number,
  rho: number,
  blockDays: number,
  rand: () => number,
): number[][] {
  const gauss = gaussianFactory(rand);
  const out: number[][] = [];
  for (let p = 0; p < nPaths; p++) {
    const row: number[] = [];
    let curBlock = -1;
    let zb = 0;
    for (let h = 0; h < horizon; h++) {
      const b = Math.floor(h / blockDays);
      if (b !== curBlock) {
        // one common block shock per (path, block), like numpy's
        // repeat(normal((P, n_blocks)), block_days, axis=1)
        curBlock = b;
        zb = gauss();
      }
      const zd = gauss();
      const z = rho * zb + Math.sqrt(Math.max(1 - rho * rho, 0)) * zd;
      row.push(Math.min(Math.max(normCdf(z), 1e-4), 1 - 1e-4));
    }
    out.push(row);
  }
  return out;
}

/**
 * (P, H) scheduled flows (signed paisa) from detected recurring streams.
 *
 * Each path draws its own date jitter (from the stream's observed gap
 * residuals) and amount (from its observed amounts). A stream already due
 * arrives within the next few days (late payment); a stream missed by more
 * than half a period skips to its next cycle.
 */
export function sampleStreamFlows(
  streams: Stream[],
  origin: Day,
  horizon: number,
  nPaths: number,
  rand: () => number,
): number[][] {
  const flows: number[][] = Array.from({ length: nPaths }, () => new Array<number>(horizon).fill(0));
  for (const s of streams) {
    if (s.anchorDom !== null && s.anchorDom !== undefined) {
      monthlyAnchorFlows(flows, s, origin, horizon, rand);
      continue;
    }
    const resid = s.gapResiduals.length ? s.gapResiduals : [0];
    const amts = s.amounts;
    for (let p = 0; p < nPaths; p++) {
      // offset = days after origin of the next occurrence (day 1 = tomorrow)
      let offset = s.lastDay - origin + s.periodDays + pick(rand, resid);
      const late = offset <= 0;
      const missed = late && -offset >= s.periodDays / 2;
      if (missed) offset += s.periodDays;
      else if (late) offset = 1 + Math.floor(rand() * 3);
      offset = Math.max(offset, 1);
      while (offset <= horizon) {
        flows[p]![offset - 1]! += s.direction * pick(rand, amts);
        offset += Math.max(s.periodDays + pick(rand, resid), 1);
      }
    }
  }
  return flows;
}

/**
 * (P, H+1) wallet paths: start + scheduled + irregular, never below zero.
 *
 * A wallet cannot go below zero: scheduled inflows land first, spending is
 * capped at what is there, and a scheduled payment larger than the balance
 * does not happen that day (paid in cash, late or not at all).
 */
export function simulateLiquidityPaths(
  startPaisa: number,
  irregularQuantiles: number[][], // (H, T)
  taus: number[],
  scheduledFlows: number[][], // (P, H)
  rho: number,
  blockDays: number,
  rand: () => number,
): number[][] {
  const nPaths = scheduledFlows.length;
  const horizon = scheduledFlows[0]?.length ?? 0;
  const u = blockCorrelatedUniforms(nPaths, horizon, rho, blockDays, rand);
  const irregular = inverseCdf(irregularQuantiles, taus, u).map((row) =>
    row.map((v) => Math.round(v)),
  );
  const paths: number[][] = [];
  for (let p = 0; p < nPaths; p++) {
    const path = new Array<number>(horizon + 1);
    path[0] = startPaisa;
    let bal = startPaisa;
    for (let h = 0; h < horizon; h++) {
      const sched = scheduledFlows[p]![h]!;
      bal = bal + Math.max(sched, 0);
      bal = Math.max(bal + irregular[p]![h]!, 0);
      const out = -Math.min(sched, 0);
      bal = out <= bal ? bal - out : bal;
      path[h + 1] = bal;
    }
    paths.push(path);
  }
  return paths;
}

function pick(rand: () => number, xs: number[]): number {
  return xs[Math.min(Math.floor(rand() * xs.length), xs.length - 1)]!;
}

/**
 * Fixed-day monthly stream (salary on the 7th, rent on the 8th): each
 * month's date is the anchor day plus an observed jitter, so one late
 * payment does not shift the next one. A month already paid (an occurrence
 * within the last half period) is skipped.
 */
function monthlyAnchorFlows(
  flows: number[][],
  s: Stream,
  origin: Day,
  horizon: number,
  rand: () => number,
): void {
  const nPaths = flows.length;
  const resid = s.domResiduals.length ? s.domResiduals : [0];
  const amts = s.amounts;
  const first = firstOfMonth(origin);
  const anchorDom = s.anchorDom!;
  for (let m = -1; m < Math.floor(horizon / 28) + 2; m++) {
    const base = monthAnchorDay(first, m, Math.min(anchorDom, 28));
    if (base - s.lastDay < s.periodDays / 2) continue; // this cycle already happened
    if (base - origin < -7) continue; // more than a week overdue: treated as missed
    for (let p = 0; p < nPaths; p++) {
      let off = base - origin + pick(rand, resid);
      if (off <= 0) off = 1 + Math.floor(rand() * 3); // slightly late: arrives soon
      if (off <= horizon) {
        flows[p]![off - 1]! += s.direction * pick(rand, amts);
      }
    }
  }
}
