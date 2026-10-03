/**
 * Cash-on-hand v2 — port of the ML handoff's core/cash_on_hand.py additions
 * (commit 0c3f8eb: per-user decay, stream-aware).
 *
 * v1 (estimateCashOnHand in analytics.ts, linear 7-day decay) stays for the
 * product's cash card. v2 is the model-side estimator: each withdrawal decays
 * exponentially with the USER'S OWN cash time constant (if cash-outs come
 * every ~g days, a withdrawal lasts ~g days), and cash-outs that belong to a
 * recurring stream (e.g. rent paid in cash) are excluded — they were spent
 * on the spot. All money is paisa. Pure.
 */

import type { Day } from "./timeutils";

/**
 * Per-user cash life (days): the median gap between distinct cash-out days,
 * clamped to [lo, hi]. Fewer than 2 gaps → the 7-day default.
 */
export function cashTimeConstantDays(cashoutDays: Day[], lo = 2.0, hi = 10.0): number {
  const days = [...new Set(cashoutDays)].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) gaps.push(days[i]! - days[i - 1]!);
  if (gaps.length < 2) return 7.0;
  const sorted = [...gaps].sort((a, b) => a - b);
  return Math.min(Math.max(sorted[Math.floor(sorted.length / 2)]!, lo), hi);
}

/**
 * v2 cash-on-hand: each withdrawal decays exponentially with the user's own
 * time constant; cash-outs on or after `asOfDay` are ignored. Withdrawals
 * that paid an obligation on the spot (e.g. rent in cash) should be excluded
 * by the caller. Returns integer paisa.
 */
export function estimateCashV2(
  cashoutDays: Day[],
  cashoutAmounts: number[],
  asOfDay: Day,
  timeConstantDays: number,
): number {
  const keep = 1.0 - 1.0 / Math.max(timeConstantDays, 1.0);
  let total = 0.0;
  for (let i = 0; i < cashoutDays.length; i++) {
    const age = asOfDay - cashoutDays[i]!;
    if (age >= 0) total += cashoutAmounts[i]! * Math.pow(keep, age);
  }
  return Math.trunc(total);
}
