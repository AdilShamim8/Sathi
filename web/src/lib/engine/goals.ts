/**
 * Financial Goal Planner + Scenario Simulation (P1).
 * Deterministic math. Options are presented, never commanded — the
 * customer remains the decision maker.
 */
import type { Goal, GoalAnalysis, GoalScenario, SimulateResult, Txn } from "./domain";
import { ALL_CATEGORIES } from "./domain";
import { daysAgo, estimateMonthlyCapacity } from "./analytics";
import { planGoal } from "./planner";
import { monthlyTotals } from "./metricsEngine";
import { cashoutFee } from "./cashout";
import { PLANNER_CONFIG, THRESHOLDS } from "./sathiConfig";

const DAY = 24 * 3600 * 1000;
const MONTH_MS = 30.44 * DAY;

export function analyzeGoal(goal: Goal, txns: Txn[], anchor: Date): GoalAnalysis {
  const targetDate = new Date(goal.targetDate);
  const monthsRemaining = Math.max(
    0.5,
    Math.round(((targetDate.getTime() - anchor.getTime()) / MONTH_MS) * 10) / 10,
  );
  const remaining = Math.max(0, goal.targetAmount - goal.savedSoFar);
  const requiredMonthly = Math.ceil(remaining / monthsRemaining);

  const { capacity } = estimateMonthlyCapacity(txns, anchor);
  const currentCapacity = capacity;

  const projectedTotal = goal.savedSoFar + currentCapacity * monthsRemaining;
  const projectedGap = Math.max(0, goal.targetAmount - projectedTotal);
  const progressPct = Math.min(100, Math.round((goal.savedSoFar / goal.targetAmount) * 100));

  const feasibility: GoalAnalysis["feasibility"] =
    currentCapacity >= requiredMonthly
      ? "on_track"
      : currentCapacity >= requiredMonthly * 0.7
        ? "tight"
        : "needs_adjustment";

  // discretionary spend profile for scenario B
  const from = daysAgo(anchor, 90);
  const win = txns.filter((t) => new Date(t.timestamp).getTime() >= from.getTime());
  const discretionaryIds = new Set(ALL_CATEGORIES.filter((c) => c.discretionary).map((c) => c.id));
  const discMonthly = new Map<string, number>();
  for (const t of win) {
    if (t.direction === "out" && discretionaryIds.has(t.category)) {
      discMonthly.set(t.category, (discMonthly.get(t.category) ?? 0) + t.amount);
    }
  }
  const topDisc = [...discMonthly.entries()].sort((a, b) => b[1] - a[1])[0];
  const topDiscMonthly = topDisc ? topDisc[1] / 3 : 0;
  const cut20 = Math.round(topDiscMonthly * 0.2);

  const scenarios: GoalScenario[] = [];
  // A: keep current behaviour
  scenarios.push({
    id: "current",
    title: "Keep current behaviour",
    description: `Continue saving about ৳${currentCapacity.toLocaleString()}/month based on your recent inflow minus outflow.`,
    monthlyContribution: currentCapacity,
    months: monthsRemaining,
    projectedTotal: Math.round(projectedTotal),
    gap: Math.round(projectedGap),
    reachesGoal: projectedGap <= 0,
  });
  // B: trim top discretionary category 20%
  if (topDisc && cut20 > 0) {
    const cat = ALL_CATEGORIES.find((c) => c.id === topDisc[0])!;
    const monthly = currentCapacity + cut20;
    const total = goal.savedSoFar + monthly * monthsRemaining;
    scenarios.push({
      id: "trim_discretionary",
      title: `Trim ${cat.labelEn} by 20%`,
      description: `You spent ~৳${Math.round(topDiscMonthly).toLocaleString()}/month on ${cat.labelEn.toLowerCase()} recently. A 20% trim frees ~৳${cut20.toLocaleString()}/month.`,
      monthlyContribution: monthly,
      months: monthsRemaining,
      projectedTotal: Math.round(total),
      gap: Math.max(0, Math.round(goal.targetAmount - total)),
      reachesGoal: total >= goal.targetAmount,
    });
  }
  // C: extend timeline to match capacity
  if (currentCapacity > 0 && projectedGap > 0) {
    const needed = Math.ceil(remaining / currentCapacity);
    const total = goal.savedSoFar + currentCapacity * needed;
    scenarios.push({
      id: "extend",
      title: "Extend the timeline",
      description: `At your current capacity, the goal is reachable in about ${needed} months instead of ${monthsRemaining}.`,
      monthlyContribution: currentCapacity,
      months: needed,
      projectedTotal: Math.round(total),
      gap: 0,
      reachesGoal: true,
    });
  }

  // D–F: Sathi Monte Carlo planner options (ported from core/planner.py) —
  // P(goal met) with Wilson 95% intervals from the user's own surplus
  // distribution, appended so the same scenario cards carry honest
  // probabilities instead of only deterministic projections.
  {
    const totals = [...monthlyTotals(txns).values()];
    const surplusSamples = totals.map((v) => v.inflow - v.outflow);
    const inflowSamples = totals.map((v) => v.inflow);
    if (surplusSamples.length) {
      const monthlyFee = Math.round(
        txns.filter((t) => t.direction === "out" && t.category === "cash_out")
          .reduce((s, t) => s + cashoutFee(t.amount), 0) / totals.length,
      );
      const plan = planGoal({
        target: remaining > 0 ? remaining : goal.targetAmount,
        months: Math.max(1, Math.round(monthsRemaining)),
        monthlySurplusSamples: surplusSamples,
        monthlyInflowSamples: inflowSamples,
        monthlyFeeLeakage: monthlyFee,
        monthlyAvoidable: Math.round(monthlyFee / 2),
        maxSafeContribution: Math.max(currentCapacity, THRESHOLDS.min_goal_monthly_contribution_paisa / 100),
        config: {
          nSimulations: 800, // lighter than the v1 API's 2000 for UI latency
          horizonCapMonths: PLANNER_CONFIG.horizon_cap_months,
          minMonthlyContribution: THRESHOLDS.min_goal_monthly_contribution_paisa / 100,
          likelyCutoff: PLANNER_CONFIG.likely_cutoff,
          uncertainCutoff: PLANNER_CONFIG.uncertain_cutoff,
        },
        seed: PLANNER_CONFIG.seed,
        asOfDate: anchor,
      });
      const titles: Record<string, string> = {
        extend_timeline: "Monte Carlo: extend at a sustainable amount",
        trim_leakage: "Monte Carlo: redirect fees + avoidable spend",
        percent_of_inflow: "Monte Carlo: save a fixed share of each inflow",
      };
      for (const opt of plan.options) {
        scenarios.push({
          id: `mc_${opt.key}`,
          title: titles[opt.key] ?? opt.key,
          description: `${opt.tradeoffEn} — estimated ${Math.round(opt.pGoalMet * 100)}% chance of success (95% range ${Math.round(opt.pLow * 100)}–${Math.round(opt.pHigh * 100)}%) at ৳${opt.monthlyContribution.toLocaleString()}/month for ${opt.months} months.${opt.percentOfInflow !== null ? ` Sets aside ${Math.round(opt.percentOfInflow * 100)}% of every inflow.` : ""}`,
          monthlyContribution: opt.monthlyContribution,
          months: opt.months,
          projectedTotal: Math.round(goal.savedSoFar + opt.monthlyContribution * opt.months),
          gap: Math.max(0, Math.round(goal.targetAmount - (goal.savedSoFar + opt.monthlyContribution * opt.months))),
          reachesGoal: opt.pGoalMet >= 0.7,
        });
      }
    }
  }

  return {
    goalId: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    targetDate: targetDate.toISOString(),
    monthsRemaining,
    requiredMonthly,
    currentCapacity,
    capacityBasis: "Average monthly (inflow − non-savings outflow) over the last 3 complete months",
    projectedTotal: Math.round(projectedTotal),
    projectedGap: Math.round(projectedGap),
    progressPct,
    feasibility,
    scenarios,
    assumptions: [
      "Capacity estimated from the last 3 complete calendar months",
      "No income growth or windfalls assumed",
      "Scenario projections are estimates, not guarantees",
    ],
  };
}

export function simulateGoal(params: {
  goal: Goal; txns: Txn[]; anchor: Date;
  extraMonthlySavings?: number; cutCategory?: string; cutPct?: number;
}): SimulateResult {
  const { goal, txns, anchor, extraMonthlySavings, cutCategory, cutPct } = params;
  const analysis = analyzeGoal(goal, txns, anchor);
  const { capacity } = estimateMonthlyCapacity(txns, anchor);

  let freedMonthly = 0;
  const tradeoffs: string[] = [];
  const assumptions: string[] = [...analysis.assumptions];

  if (extraMonthlySavings && extraMonthlySavings > 0) {
    freedMonthly += extraMonthlySavings;
    tradeoffs.push(
      `Setting aside ৳${extraMonthlySavings.toLocaleString()} more each month reduces your flexible spending by the same amount.`,
    );
  }
  if (cutCategory && cutPct && cutPct > 0) {
    const from = daysAgo(anchor, 90);
    const catSpend = txns
      .filter((t) => new Date(t.timestamp).getTime() >= from.getTime() && t.direction === "out" && t.category === cutCategory)
      .reduce((s, t) => s + t.amount, 0) / 3;
    const freed = Math.round(catSpend * (cutPct / 100));
    freedMonthly += freed;
    const cat = ALL_CATEGORIES.find((c) => c.id === cutCategory);
    tradeoffs.push(
      `Cutting ${cat?.labelEn ?? cutCategory} by ${cutPct}% frees ~৳${freed.toLocaleString()}/month, but reduces that lifestyle/essential spending.`,
    );
    assumptions.push(`Recent ${cat?.labelEn ?? cutCategory} spend assumed representative (~৳${Math.round(catSpend).toLocaleString()}/month)`);
  }

  const newCapacity = capacity + freedMonthly;
  const remaining = Math.max(0, goal.targetAmount - goal.savedSoFar);
  const monthsToGoal = newCapacity > 0 ? Math.ceil(remaining / newCapacity) : null;
  const baselineMonths = capacity > 0 ? Math.ceil(remaining / capacity) : null;

  const projectedTotal = Math.round(goal.savedSoFar + newCapacity * analysis.monthsRemaining);

  return {
    extraMonthlySavings,
    cutCategory,
    cutPct,
    freedMonthly,
    newCapacity,
    projectedTotal,
    projectedGap: Math.max(0, goal.targetAmount - projectedTotal),
    monthsToGoal,
    monthsSaved:
      baselineMonths !== null && monthsToGoal !== null
        ? Math.max(0, baselineMonths - monthsToGoal)
        : null,
    tradeoffs,
    assumptions,
  };
}
