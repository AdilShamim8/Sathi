/**
 * Spending Intelligence + recurring detection.
 * Pure deterministic statistics — no ML, no LLM. Every number traceable.
 *
 * P0 rule: recurring patterns (including salary-like income) are detected
 * from TRANSACTION HISTORY ONLY — never from persona or config.
 */
import type {
  CategoryStat, RecurringPattern, SpendingIntelligence, Txn, CashOnHand,
} from "./domain";
import { ALL_CATEGORIES } from "./domain";

const DAY = 24 * 3600 * 1000;

export function startOfDay(d: Date | string): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysAgo(anchor: Date, n: number): Date {
  return new Date(startOfDay(anchor).getTime() - n * DAY);
}

function inWindow(t: Date, from: Date, to: Date): boolean {
  return t.getTime() >= from.getTime() && t.getTime() < to.getTime();
}

export function computeSpendingIntelligence(txns: Txn[], anchor: Date): SpendingIntelligence {
  const periodDays = 30;
  const thisStart = daysAgo(anchor, periodDays);
  const lastStart = daysAgo(anchor, periodDays * 2);
  const end = new Date(anchor.getTime() + DAY);

  const thisMonth = txns.filter((t) => inWindow(new Date(t.timestamp), thisStart, end));
  const lastMonth = txns.filter((t) => inWindow(new Date(t.timestamp), lastStart, thisStart));

  const sum = (list: Txn[], dir: "in" | "out") =>
    list.filter((t) => t.direction === dir).reduce((s, t) => s + t.amount, 0);

  const totalIn = sum(thisMonth, "in");
  const totalOut = sum(thisMonth, "out");
  const lastMonthIn = sum(lastMonth, "in");
  const lastMonthOut = sum(lastMonth, "out");

  // category stats
  const categories: CategoryStat[] = ALL_CATEGORIES.map((c) => {
    const tOut = thisMonth.filter((t) => t.direction === "out" && t.category === c.id);
    const lOut = lastMonth.filter((t) => t.direction === "out" && t.category === c.id);
    const tSum = tOut.reduce((s, t) => s + t.amount, 0);
    const lSum = lOut.reduce((s, t) => s + t.amount, 0);
    return {
      category: c.id, labelEn: c.labelEn, labelBn: c.labelBn,
      thisMonth: tSum, lastMonth: lSum,
      changePct: lSum > 0 ? ((tSum - lSum) / lSum) * 100 : tSum > 0 ? 100 : null,
      share: totalOut > 0 ? (tSum / totalOut) * 100 : 0,
      txCount: tOut.length,
      avgAmount: tOut.length > 0 ? Math.round(tSum / tOut.length) : 0,
    };
  })
    .filter((c) => c.thisMonth > 0 || c.lastMonth > 0)
    .sort((a, b) => b.thisMonth - a.thisMonth);

  // recurring detection over 90 days — BOTH directions
  const win90 = txns.filter((t) => inWindow(new Date(t.timestamp), daysAgo(anchor, 90), end));
  const recurringAll = detectRecurring(win90);
  const recurring = recurringAll.filter((r) => r.direction === "out");
  const recurringIncome = recurringAll.filter((r) => r.direction === "in");

  // cash-out behaviour
  const cashOutTx = thisMonth.filter((t) => t.category === "cash_out" && t.direction === "out");
  const cashOutTotal = cashOutTx.reduce((s, t) => s + t.amount, 0);

  // month-end pattern over last 90 days
  const meSplit = computeMonthEndSplit(win90, anchor);

  const top = categories[0];

  // anomalies: z-score per category on outflow amounts (90d), |z| >= 2.5
  const anomalies: SpendingIntelligence["anomalies"] = [];
  const byCat = new Map<string, number[]>();
  for (const t of win90) {
    if (t.direction !== "out") continue;
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category)!.push(t.amount);
  }
  const stats = new Map<string, { mean: number; sd: number }>();
  for (const [cat, amounts] of byCat) {
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    stats.set(cat, { mean, sd: Math.sqrt(variance) || 1 });
  }
  for (const t of win90) {
    if (t.direction !== "out") continue;
    const st = stats.get(t.category);
    if (!st) continue;
    const z = (t.amount - st.mean) / st.sd;
    if (z >= 2.5) {
      anomalies.push({
        id: t.id,
        timestamp: new Date(t.timestamp).toISOString(),
        amount: t.amount, category: t.category, merchant: t.merchant,
        zScore: Math.round(z * 10) / 10,
        reason: `৳${t.amount.toLocaleString()} is ${z.toFixed(1)}σ above your usual ${t.category} spend (avg ৳${Math.round(st.mean).toLocaleString()})`,
      });
    }
  }
  anomalies.sort((a, b) => b.zScore - a.zScore);

  // daily essentials: mean daily spend on essential categories over 90 days
  const essentialIds = new Set(ALL_CATEGORIES.filter((c) => c.essential).map((c) => c.id));
  const essentials90 = win90.filter((t) => t.direction === "out" && essentialIds.has(t.category)).reduce((s, t) => s + t.amount, 0);
  const dailyEssentials = Math.round(essentials90 / 90);

  return {
    periodDays,
    totalIn, totalOut, net: totalIn - totalOut,
    lastMonthIn, lastMonthOut,
    categories,
    recurring: recurring.slice(0, 12),
    recurringIncome,
    cashOut: {
      count: cashOutTx.length, total: cashOutTotal,
      shareOfOutflow: totalOut > 0 ? (cashOutTotal / totalOut) * 100 : 0,
    },
    monthEndPattern: meSplit,
    concentration: { topCategory: top?.category ?? "other", topShare: top?.share ?? 0 },
    anomalies: anomalies.slice(0, 8),
    dailyEssentials,
  };
}

/**
 * Recurring-pattern detection from raw transactions (P0).
 * A pattern = same (direction, category, subcategory|merchant) appearing in
 * 3+ distinct weeks over the trailing 90 days. For monthly cadence we also
 * learn the modal day-of-month — that is how salary timing is discovered
 * from history alone.
 */
export function detectRecurring(txns: Txn[]): RecurringPattern[] {
  const DAY = 24 * 3600 * 1000;
  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const key = `${t.direction}|${t.category}|${t.subcategory ?? ""}|${t.merchant ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const out: RecurringPattern[] = [];
  for (const [key, list] of groups) {
    const weeks = new Set(list.map((t) => Math.floor(new Date(t.timestamp).getTime() / (7 * DAY))));
    const months = new Set(list.map((t) => {
      const ts = new Date(t.timestamp);
      return `${ts.getFullYear()}-${ts.getMonth()}`;
    }));
    const perWeek = list.length / (90 / 7);
    const isMonthlyish = perWeek < 0.7;
    // weekly/daily patterns need 3+ distinct weeks; monthly patterns are
    // accepted with 2+ distinct calendar months (a 90-day window edge can
    // legitimately contain only two occurrences of a monthly event)
    const enough = weeks.size >= 3 || (isMonthlyish && months.size >= 2);
    if (!enough || list.length < 2) continue;
    const [direction, category, subcategory, merchant] = key.split("|");
    const total = list.reduce((s, t) => s + t.amount, 0);
    const cadence: RecurringPattern["cadence"] =
      perWeek >= 3.5 ? "daily-ish" : perWeek >= 1.5 ? "several times a week" : perWeek >= 0.7 ? "weekly" : "monthly";

    // modal day-of-month for monthly cadence (salary timing discovery).
    // Cluster ±2 neighbouring days first — salaries land with 1–3 day jitter,
    // so an exact-day mode would miss the pattern.
    let typicalDayOfMonth: number | null = null;
    if (cadence === "monthly") {
      const domCounts = new Map<number, number>();
      for (const t of list) {
        const dom = new Date(t.timestamp).getDate();
        domCounts.set(dom, (domCounts.get(dom) ?? 0) + 1);
      }
      let bestDom: number | null = null;
      let bestCount = 0;
      for (let dom = 1; dom <= 31; dom++) {
        let clusterCount = 0;
        for (let d = dom - 2; d <= dom + 2; d++) {
          clusterCount += domCounts.get(d) ?? 0;
        }
        if (clusterCount > bestCount) { bestCount = clusterCount; bestDom = dom; }
      }
      if (bestDom !== null && bestCount >= Math.ceil(list.length * 0.6)) typicalDayOfMonth = bestDom;
    }

    out.push({
      key,
      label: subcategory || category,
      category,
      direction: direction as "in" | "out",
      merchant: merchant || null,
      occurrences: list.length,
      avgAmount: Math.round(total / list.length),
      cadence,
      monthlyEstimate: Math.round((total / 90) * 30),
      typicalDayOfMonth,
    });
  }
  out.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
  return out;
}

/** Outflow/inflow on calendar days 21–31 (the dry spell before the next payday). */
export function computeMonthEndSplit(txns: Txn[], _anchor: Date): {
  lateOutflow: number; lateInflow: number; lateShare: number; drySpell: boolean;
} {
  let totalOut = 0, lateOutflow = 0, lateInflow = 0;
  for (const t of txns) {
    const late = new Date(t.timestamp).getDate() >= 21;
    if (t.direction === "out") {
      totalOut += t.amount;
      if (late) lateOutflow += t.amount;
    } else if (late) {
      lateInflow += t.amount;
    }
  }
  return {
    lateOutflow, lateInflow,
    lateShare: totalOut > 0 ? (lateOutflow / totalOut) * 100 : 0,
    drySpell: lateOutflow >= 3000 && lateInflow < lateOutflow * 0.1,
  };
}

/**
 * Estimated monthly savings capacity from the last 3 COMPLETE calendar
 * months (the current partial month would distort the average).
 */
export function estimateMonthlyCapacity(txns: Txn[], anchor: Date): {
  capacity: number; avgIn: number; avgOut: number;
} {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const threeBack = new Date(anchor.getFullYear(), anchor.getMonth() - 3, 1);
  const win = txns.filter((t) => {
    const ts = new Date(t.timestamp);
    return ts.getTime() >= threeBack.getTime() && ts.getTime() < monthStart.getTime();
  });
  const monthsCovered = Math.max(1, Math.min(3, new Set(win.map((t) => {
    const ts = new Date(t.timestamp);
    return `${ts.getFullYear()}-${ts.getMonth()}`;
  })).size));
  const inflow = win.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const outflow = win.filter((t) => t.direction === "out" && t.category !== "savings").reduce((s, t) => s + t.amount, 0);
  const avgIn = inflow / monthsCovered;
  const avgOut = outflow / monthsCovered;
  return { capacity: Math.max(0, Math.round(avgIn - avgOut)), avgIn: Math.round(avgIn), avgOut: Math.round(avgOut) };
}

/**
 * P0: Cash-on-hand estimation.
 * Wallet balance = opening + all inflows − all outflows (full history).
 * Income timing is discovered from recurring-inflow detection, NOT config.
 * The user-set salary (optional) only fills gaps when history is silent.
 */
export function estimateCashOnHand(
  txns: Txn[],
  anchor: Date,
  openingBalance: number,
  userSalary?: { amount: number | null; payDay: number | null },
): CashOnHand {
  const DAY = 24 * 3600 * 1000;
  const end = new Date(anchor.getTime() + DAY);
  const win90 = txns.filter((t) => inWindow(new Date(t.timestamp), daysAgo(anchor, 90), end));

  const walletBalance = openingBalance
    + txns.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0)
    - txns.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);

  // recurring income discovery from history (salary-like: monthly, large, modal day)
  const recurringIn = detectRecurring(win90).filter((r) => r.direction === "in" && r.cadence === "monthly");
  const salaryLike = recurringIn[0] ?? null;

  const essentialIds = new Set(ALL_CATEGORIES.filter((c) => c.essential).map((c) => c.id));
  const essentials90 = win90.filter((t) => t.direction === "out" && essentialIds.has(t.category)).reduce((s, t) => s + t.amount, 0);
  const dailyEssentials = Math.round(essentials90 / 90);

  // days to next income: from detected modal day; fall back to user-set pay day
  let salaryDom = salaryLike?.typicalDayOfMonth ?? null;
  let salaryAmount = salaryLike?.avgAmount ?? 0;
  let detected = salaryLike !== null;
  if (salaryDom === null && userSalary?.payDay) {
    salaryDom = userSalary.payDay;
    detected = false;
  }
  if (userSalary?.amount && (!salaryAmount || !detected)) {
    // user-declared salary refines the estimate when history is ambiguous
    salaryAmount = detected ? Math.round((salaryAmount + userSalary.amount) / 2) : userSalary.amount;
  }

  let daysToNextIncome: number | null = null;
  let nextIncomeDate: Date | null = null;
  if (salaryDom !== null) {
    const today = startOfDay(anchor);
    let next = new Date(today.getFullYear(), today.getMonth(), Math.min(salaryDom, 28));
    if (next.getTime() <= today.getTime()) {
      next = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(salaryDom, 28));
    }
    nextIncomeDate = next;
    daysToNextIncome = Math.max(0, Math.round((next.getTime() - today.getTime()) / DAY));
  }

  const avgMonthlyIncome = Math.round(
    win90.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0) / 3,
  );

  return {
    walletBalance,
    avgMonthlyIncome,
    daysToNextIncome,
    nextIncomeDate: nextIncomeDate ? nextIncomeDate.toISOString() : null,
    nextIncomeEstimate: salaryAmount,
    salaryDetectedFromHistory: detected,
    dailyEssentials,
    basis: "Cash-on-hand = opening balance + lifetime inflows − outflows; salary timing learned from recurring inflows in your transaction history",
  };
}
