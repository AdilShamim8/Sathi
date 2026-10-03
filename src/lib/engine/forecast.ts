/**
 * Cash-flow forecasting — deterministic/statistical baseline.
 *
 * Method: calendar day-of-month historical averages over the trailing 90
 * days (salary on the 1st–3rd and month-end cash-outs are learned as
 * calendar patterns), with empirical daily dispersion for bounds.
 * This baseline is the reference the ML risk model is compared against.
 */
import type { Txn, ForecastResult, Pressure } from "./domain";
import { FORECAST_MODEL_VERSION } from "./domain";
import { daysAgo, startOfDay, computeMonthEndSplit } from "./analytics";

const DAY = 24 * 3600 * 1000;

export function forecastCashflow(
  txns: Txn[],
  anchor: Date,
  horizonDays = 7,
  balanceEstimate = 0,
): ForecastResult {
  const from = daysAgo(anchor, 90);
  const win = txns.filter((t) => {
    const ts = new Date(t.timestamp);
    return ts.getTime() >= from.getTime() && ts.getTime() <= anchor.getTime() + DAY;
  });

  // per calendar day-of-month samples (1..31)
  const outByDay = new Map<number, number[]>();
  const inByDay = new Map<number, number[]>();
  for (const t of win) {
    const dom = new Date(t.timestamp).getDate();
    const map = t.direction === "out" ? outByDay : inByDay;
    if (!map.has(dom)) map.set(dom, []);
    map.get(dom)!.push(t.amount);
  }

  const avgOutPerDay = win.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0) / 90;

  // recurring-inflow (salary) detection: large inflows cluster on a modal
  // day-of-month; predict ONE occurrence per cycle on that day only.
  const bigInflows = win.filter((t) => t.direction === "in" && t.amount >= 5000);
  let salaryDom: number | null = null;
  let salaryAmount = 0;
  if (bigInflows.length >= 2) {
    const counts = new Map<number, { n: number; total: number }>();
    for (const t of bigInflows) {
      const dom = new Date(t.timestamp).getDate();
      const e = counts.get(dom) ?? { n: 0, total: 0 };
      counts.set(dom, { n: e.n + 1, total: e.total + t.amount });
    }
    const entries = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || b[1].total - a[1].total);
    const [dom, stat] = entries[0];
    salaryDom = dom;
    salaryAmount = Math.round(stat.total / stat.n);
  }

  const dailySeries: ForecastResult["dailySeries"] = [];
  let expectedOutflow = 0;
  let expectedInflow = 0;
  // if the salary already landed within the last 5 days, it has already been
  // paid this cycle — don't predict it again inside the horizon.
  const lastBigInflow = bigInflows.length
    ? Math.max(...bigInflows.map((t) => new Date(t.timestamp).getTime()))
    : 0;
  let salaryCounted = lastBigInflow > anchor.getTime() - 5 * DAY;

  let cumNet = balanceEstimate;
  for (let h = 1; h <= horizonDays; h++) {
    const future = new Date(startOfDay(anchor).getTime() + h * DAY);
    const dom = future.getDate();
    const outs = outByDay.get(dom) ?? [];
    const ins = inByDay.get(dom) ?? [];
    // expected outflow: blend of day-of-month mean and global daily mean (shrinkage)
    const dayMean = outs.length > 0 ? outs.reduce((s, a) => s + a, 0) / outs.length : 0;
    const expected = outs.length >= 2 ? dayMean : dayMean * 0.4 + avgOutPerDay * 0.6;
    // inflow: salary only on its modal day (once per horizon); irregular
    // inflows (freelance etc.) are NOT predicted — conservative by design.
    let inMean = 0;
    if (salaryDom !== null && !salaryCounted && dom === salaryDom) {
      inMean = salaryAmount;
      salaryCounted = true;
    } else if (salaryDom === null && ins.length > 0) {
      inMean = ins.reduce((s, a) => s + a, 0) / ins.length;
    }
    expectedOutflow += expected;
    expectedInflow += inMean;
    cumNet += inMean - expected;
    dailySeries.push({
      day: future.toISOString().slice(0, 10),
      expectedOutflow: Math.round(expected),
      expectedInflow: Math.round(inMean),
      cumNet: Math.round(cumNet),
    });
  }

  // uncertainty: dispersion of daily outflow across the window
  const dailyTotals = new Map<number, number>();
  for (const t of win) {
    if (t.direction !== "out") continue;
    const dk = Math.floor(startOfDay(t.timestamp).getTime() / DAY);
    dailyTotals.set(dk, (dailyTotals.get(dk) ?? 0) + t.amount);
  }
  const totals = [...dailyTotals.values()];
  const mean = totals.reduce((s, a) => s + a, 0) / Math.max(1, totals.length);
  const sd = Math.sqrt(totals.reduce((s, a) => s + (a - mean) ** 2, 0) / Math.max(1, totals.length));
  const horizonSd = sd * Math.sqrt(horizonDays);

  const net = expectedInflow - expectedOutflow;
  const lowerBound = Math.round(net - 1.28 * horizonSd); // ~80% interval
  const upperBound = Math.round(net + 1.28 * horizonSd);

  // pressure scoring (deterministic rules — separated from the estimate itself)
  const factors: string[] = [];
  let score = 0;

  const recent30 = win.filter((t) => new Date(t.timestamp).getTime() >= daysAgo(anchor, 30).getTime());
  const prev30 = win.filter((t) => {
    const ts = new Date(t.timestamp).getTime();
    return ts >= daysAgo(anchor, 60).getTime() && ts < daysAgo(anchor, 30).getTime();
  });
  const outRecent = recent30.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const outPrev = prev30.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  if (outPrev > 0 && (outRecent - outPrev) / outPrev > 0.1) {
    score += 1;
    factors.push(`Recent spending is up ${(((outRecent - outPrev) / outPrev) * 100).toFixed(0)}% vs the previous 30 days`);
  }

  const meSplit = computeMonthEndSplit(win, anchor);
  const anchorDay = anchor.getDate();
  const nearMonthEnd = anchorDay >= 20 || anchorDay <= 3;
  if (meSplit.drySpell && nearMonthEnd) {
    score += 1;
    factors.push(`Days 21–31 typically see ~৳${Math.round(meSplit.lateOutflow / 3).toLocaleString()} leave per month while no income arrives (dry spell before payday)`);
  }

  if (net < 0) {
    score += 1;
    factors.push(`Expected outflow exceeds expected inflow by ৳${Math.abs(Math.round(net)).toLocaleString()} over the next ${horizonDays} days`);
  }
  if (balanceEstimate > 0 && expectedOutflow > balanceEstimate * 0.5) {
    score += 1;
    factors.push("Expected outflow is large relative to the estimated current balance");
  }
  if (factors.length === 0) factors.push("Inflow and outflow patterns look balanced for the coming days");

  const pressure: Pressure = score >= 3 ? "high" : score >= 1 ? "medium" : "low";
  const confidence = win.length >= 40 ? "medium" : "low";

  return {
    generatedAt: anchor.toISOString(),
    horizonDays,
    expectedInflow: Math.round(expectedInflow),
    expectedOutflow: Math.round(expectedOutflow),
    net: Math.round(net),
    lowerBound,
    upperBound,
    pressure,
    pressureScore: score,
    factors,
    dailySeries,
    assumptions: [
      "Baseline model: calendar day-of-month averages over the trailing 90 days",
      "Detected recurring salary is projected once per cycle on its usual day; irregular inflows are not predicted (conservative)",
      "Bounds show an approximate 80% interval from historical daily dispersion",
      "Forecast is an estimate, not a certainty",
    ],
    confidence,
    modelVersion: FORECAST_MODEL_VERSION,
    periodAnalyzed: "trailing 90 days",
  };
}

/**
 * Backtest hook: rolling-origin evaluation of the baseline against a holdout.
 * Returns MAE/MAPE on daily outflow — one bar any ML upgrade must beat.
 */
export function backtestBaseline(txns: Txn[], testDays = 30): {
  mae: number; mape: number; n: number;
} {
  if (txns.length === 0) return { mae: 0, mape: 0, n: 0 };
  const maxTs = Math.max(...txns.map((t) => new Date(t.timestamp).getTime()));
  const anchor = new Date(maxTs - testDays * DAY);
  const train = txns.filter((t) => new Date(t.timestamp).getTime() <= anchor.getTime());
  const test = txns.filter((t) => new Date(t.timestamp).getTime() > anchor.getTime());

  const fc = forecastCashflow(train, anchor, testDays, 0);
  const actualByDay = new Map<string, number>();
  for (const t of test) {
    if (t.direction !== "out") continue;
    const k = new Date(t.timestamp).toISOString().slice(0, 10);
    actualByDay.set(k, (actualByDay.get(k) ?? 0) + t.amount);
  }
  let absErr = 0, ape = 0, n = 0;
  for (const d of fc.dailySeries) {
    const actual = actualByDay.get(d.day) ?? 0;
    absErr += Math.abs(actual - d.expectedOutflow);
    if (actual > 0) ape += Math.abs(actual - d.expectedOutflow) / actual;
    n++;
  }
  return {
    mae: Math.round(absErr / Math.max(1, n)),
    mape: Math.round((ape / Math.max(1, n)) * 1000) / 10,
    n,
  };
}
