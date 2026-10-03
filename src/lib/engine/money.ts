/**
 * Money arithmetic — ported from Sathi core/money.py.
 *
 * Integer-first discipline: the Sathi engine reasons in integer paisa with
 * rates expressed in integer basis points (100 bps = 1%). This app's internal
 * engines work in whole taka; this module provides the exact half-up
 * rounding used by Sathi so fee math is identical.
 *
 * Hand-check (from Sathi): ৳1,000 = 100,000 paisa at 150 bps (1.5%)
 * → 100,000 × 150 / 10,000 = 1,500 paisa = ৳15.00.
 */

export const BASIS_POINTS_PER_UNIT = 10_000; // 100 bps = 1%
export const PAISA_PER_TAKA = 100;

/** Fee for `amount` at `rateBps` basis points, rounded half up. Amounts in the same unit. */
export function applyRate(amount: number, rateBps: number, minFee = 0): number {
  if (amount < 0 || rateBps < 0) {
    throw new Error("amount and rateBps must be non-negative");
  }
  // Half-up rounding on integers: (2*x + d) // (2*d) is exact and safe.
  const num = Math.round(amount * rateBps);
  const fee = Math.floor((2 * num + BASIS_POINTS_PER_UNIT) / (2 * BASIS_POINTS_PER_UNIT));
  if (fee > 0 && fee < minFee) return minFee;
  return fee;
}

/** Convert a taka figure to paisa, rounding half up. Input to engines only. */
export function takaToPaisa(taka: number): number {
  if (taka < 0) throw new Error("taka must be non-negative");
  return Math.floor(taka * 100 + 0.5);
}

/** Convert paisa back to whole taka (half up). */
export function paisaToTaka(paisa: number): number {
  return Math.floor(paisa / 100 + 0.5);
}
