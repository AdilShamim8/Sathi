/**
 * Insight generation — deterministic rules over analytics output.
 * Each insight carries structured evidence so the "WHY?" engine can answer:
 * what happened, why we think so, what evidence, what options.
 * Tone rule: never shame the user.
 */
import type { Txn, EvidenceItem, Severity, SpendingIntelligence, SafeToSpendResult, ShortfallRiskResult } from "./domain";
import { categoryLabel } from "./domain";
import { estimateMonthlyCapacity } from "./analytics";
import { forecastCashflow } from "./forecast";
import { detectCashoutPatterns } from "./cashout";
import { computeMetrics } from "./metricsEngine";

export interface GeneratedInsight {
  insightType: string;
  severity: Severity;
  title: string;
  body: string;
  evidence: EvidenceItem[];
  options: string[];
}

export function generateInsights(
  intel: SpendingIntelligence,
  txns: Txn[],
  anchor: Date,
  balanceEstimate: number,
  safeToSpend?: SafeToSpendResult,
  risk?: ShortfallRiskResult,
): GeneratedInsight[] {
  const out: GeneratedInsight[] = [];
  const fc = forecastCashflow(txns, anchor, 7, balanceEstimate);
  const { capacity } = estimateMonthlyCapacity(txns, anchor);

  // 0. P0: shortfall risk early warning (ML)
  if (risk && risk.probability >= 0.3) {
    const pct = Math.round(risk.probability * 100);
    out.push({
      insightType: "shortfall_risk",
      severity: risk.probability >= 0.6 ? "alert" : "warning",
      title: `${pct}% chance of a shortfall in the next 7 days`,
      body: `The forecast model estimates a ${pct}% probability that your balance dips below your essential-spend safety line within 7 days${risk.troughDay ? `, most likely around ${new Date(risk.troughDay).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}. This is a probability, not a certainty — it means deferring discretionary spending through the window would be prudent.`,
      evidence: [
        { label: "Shortfall probability (ML)", value: `${pct}%` },
        { label: "Model", value: risk.modelVersion },
        { label: "Simple rule would say", value: risk.baselineRuleProbability === 1 ? "risk (balance < expected 7-day outflow)" : "no risk" },
        ...risk.topFactors.slice(0, 3).map((f) => ({ label: f.label, value: f.value })),
      ],
      options: [
        "Defer a discretionary purchase past the risky window",
        "Check the safe-to-spend daily budget",
        "Review upcoming commitments in Cash Flow",
      ],
    });
  }

  // 0b. P0: safe-to-spend status
  if (safeToSpend && (safeToSpend.status === "tight" || safeToSpend.status === "deficit")) {
    out.push({
      insightType: "safe_to_spend",
      severity: safeToSpend.status === "deficit" ? "alert" : "warning",
      title: `Safe-to-spend is ৳${safeToSpend.safeToSpendTotal.toLocaleString()} over the next ${safeToSpend.horizonDays} days`,
      body: `After reserving ৳${safeToSpend.upcomingCommitments.toLocaleString()} of recurring commitments, a ৳${safeToSpend.safetyBuffer.toLocaleString()} safety buffer and prorated savings, your flexible spending room is limited to about ৳${safeToSpend.dailySafeBudget.toLocaleString()} per day. ${safeToSpend.adviceEn}`,
      evidence: safeToSpend.breakdown.map((b) => ({ label: b.label, value: `৳${Math.abs(b.amount).toLocaleString()}` })),
      options: [
        "Keep discretionary spend under the daily budget",
        "Shift one non-urgent expense after the next income",
        "Ask the copilot why commitments are high",
      ],
    });
  }

  // 1. fastest-growing category
  const rising = intel.categories
    .filter((c) => c.changePct !== null && c.changePct >= 15 && c.thisMonth >= 500)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
  if (rising) {
    out.push({
      insightType: "category_trend",
      severity: rising.changePct! >= 40 ? "warning" : "info",
      title: `${rising.labelEn} spending is up ${Math.round(rising.changePct!)}%`,
      body: `You spent ৳${rising.thisMonth.toLocaleString()} on ${rising.labelEn.toLowerCase()} in the last 30 days, up from ৳${rising.lastMonth.toLocaleString()} in the 30 days before. That is information, not a verdict — it only matters relative to your goals.`,
      evidence: [
        { label: "Last 30 days", value: `৳${rising.thisMonth.toLocaleString()}` },
        { label: "Previous 30 days", value: `৳${rising.lastMonth.toLocaleString()}` },
        { label: "Change", value: `+${Math.round(rising.changePct!)}%` },
        { label: "Transactions", value: `${rising.txCount}` },
        { label: "Avg per transaction", value: `৳${rising.avgAmount.toLocaleString()}` },
      ],
      options: [
        "See which merchants or subcategories drive the increase",
        "Simulate trimming this category toward a goal",
        "No action — it may be intentional",
      ],
    });
  }

  // 2. month-end dry spell
  if (intel.monthEndPattern.drySpell) {
    const monthlyLate = Math.round(intel.monthEndPattern.lateOutflow / 3);
    out.push({
      insightType: "month_end_pressure",
      severity: "warning",
      title: "A dry spell before payday repeats each month",
      body: `About ৳${monthlyLate.toLocaleString()} per month leaves your wallet during days 21–31, after the month's income has already arrived and essentials are paid. That stretch — not overspending alone — is usually when the pressure appears.`,
      evidence: [
        { label: "Outflow on days 21–31 (per month)", value: `~৳${monthlyLate.toLocaleString()}` },
        { label: "Inflow on days 21–31", value: `~৳${Math.round(intel.monthEndPattern.lateInflow / 3).toLocaleString()}` },
        { label: "Share of outflow in that window", value: `${Math.round(intel.monthEndPattern.lateShare)}%` },
        { label: "Cash-outs this month", value: `${intel.cashOut.count} (৳${intel.cashOut.total.toLocaleString()})` },
      ],
      options: [
        "Hold back a fixed buffer on salary day for days 21–31",
        "Move one discretionary purchase earlier or later in the month",
        "Review the cash-out pattern for fee savings",
      ],
    });
  }

  // 3. cash-out behaviour
  if (intel.cashOut.shareOfOutflow > 8) {
    out.push({
      insightType: "cash_out_pattern",
      severity: "info",
      title: "Frequent cash-outs carry hidden cost",
      body: `You cashed out ${intel.cashOut.count} times (৳${intel.cashOut.total.toLocaleString()}, ${Math.round(intel.cashOut.shareOfOutflow)}% of outflow) in the last 30 days. Each withdrawal can carry a fee, and cash leaves no spending record.`,
      evidence: [
        { label: "Cash-out count (30d)", value: `${intel.cashOut.count}` },
        { label: "Cash-out total (30d)", value: `৳${intel.cashOut.total.toLocaleString()}` },
        { label: "Share of outflow", value: `${Math.round(intel.cashOut.shareOfOutflow)}%` },
      ],
      options: [
        "Pay merchants directly from the wallet where accepted",
        "Batch withdrawals into fewer, larger ones",
        "Keep cash-out for cases where digital payment is not possible",
      ],
    });
  }

  // 4. anomaly
  const topAnomaly = intel.anomalies[0];
  if (topAnomaly) {
    out.push({
      insightType: "unusual_spend",
      severity: "info",
      title: `One unusual ${categoryLabel(topAnomaly.category).toLowerCase()} transaction`,
      body: `${topAnomaly.reason}. A single large purchase is not automatically a problem — was it planned?`,
      evidence: [
        { label: "Amount", value: `৳${topAnomaly.amount.toLocaleString()}` },
        { label: "Merchant", value: topAnomaly.merchant ?? "—" },
        { label: "Deviation", value: `${topAnomaly.zScore}σ above your usual` },
      ],
      options: [
        "If planned: nothing to do",
        "If unplanned: review the transaction and consider a dispute",
        "See how it affects this month's goal capacity",
      ],
    });
  }

  // 5. positive: savings capacity
  if (capacity > 0) {
    out.push({
      insightType: "savings_capacity",
      severity: "positive",
      title: `You have ~৳${capacity.toLocaleString()}/month of savings capacity`,
      body: `Based on the last 90 days, your inflow exceeds non-savings outflow by about ৳${capacity.toLocaleString()} per month on average. Directing even part of it on payday builds a real buffer.`,
      evidence: [
        { label: "Est. monthly capacity", value: `৳${capacity.toLocaleString()}` },
        { label: "Basis", value: "Trailing 90 days" },
        { label: "7-day pressure outlook", value: fc.pressure.toUpperCase() },
      ],
      options: [
        "Create or top up a savings goal",
        "Try pay-yourself-first on salary day",
        "Simulate saving ৳1,500 more per month",
      ],
    });
  }

  // 6. forecast pressure heads-up
  if (fc.pressure !== "low") {
    out.push({
      insightType: "forecast_pressure",
      severity: fc.pressure === "high" ? "alert" : "warning",
      title: `Next ${fc.horizonDays} days: ${fc.pressure} pressure expected`,
      body: `Expected outflow ৳${fc.expectedOutflow.toLocaleString()} vs inflow ৳${fc.expectedInflow.toLocaleString()}. This is an estimate, not a certainty.`,
      evidence: [
        { label: "Expected inflow", value: `৳${fc.expectedInflow.toLocaleString()}` },
        { label: "Expected outflow", value: `৳${fc.expectedOutflow.toLocaleString()}` },
        { label: "Range (80%)", value: `৳${fc.lowerBound.toLocaleString()} to ৳${fc.upperBound.toLocaleString()} net` },
        ...fc.factors.slice(0, 3).map((f) => ({ label: "Factor", value: f })),
      ],
      options: [
        "See the day-by-day forecast",
        "Delay a discretionary purchase past the pressure window",
        "Review recurring expenses before month-end",
      ],
    });
  }

  // 7. Sathi cash-out fee audit (P1, from the reference engine):
  // repeat agent withdrawals that could plausibly have been digital payments.
  {
    const window90 = txns.filter(
      (t) => new Date(t.timestamp).getTime() > anchor.getTime() - 90 * 24 * 3600 * 1000,
    );
    const audit = detectCashoutPatterns(window90);
    if (audit.replaceableFeeSaved >= 20) {
      out.push({
        insightType: "cashout_fee_audit",
        severity: "info",
        title: `৳${audit.replaceableFeeSaved.toLocaleString()} of cash-out fees could be avoided`,
        body: `Of your last ${audit.totalCashouts} cash-outs, ${audit.replaceableCount} were followed within 2 days by a payment to a merchant that accepts digital — those could have been paid directly with no cash-out at all. Over a year that is roughly ৳${Math.round(audit.replaceableFeeSaved * (365 / 90)).toLocaleString()} in avoidable fees (at the illustrative 1.5% agent rate).`,
        evidence: [
          { label: "Cash-outs (90d)", value: `${audit.totalCashouts}× · ৳${audit.totalFees.toLocaleString()} fees` },
          { label: "Replaceable with digital", value: `${audit.replaceableCount}× · ৳${audit.replaceableAmount.toLocaleString()}` },
          { label: "Avoidable fees", value: `৳${audit.replaceableFeeSaved.toLocaleString()}` },
          { label: "Fee assumption", value: "150 bps, min ৳5 (illustrative)" },
          ...(audit.cashDependencyRatio !== null
            ? [{ label: "Cash dependency", value: `${Math.round(audit.cashDependencyRatio * 100)}% of outflow` }]
            : []),
        ],
        options: [
          "Pay merchants directly where digital is accepted",
          "Batch withdrawals into fewer, larger cash-outs",
          "See the full audit on the v1 cashout-insights endpoint",
        ],
      });
    }
  }

  // 8. Sathi financial-health metrics (buffer days, fee leakage, volatility).
  {
    const metrics = computeMetrics(txns, balanceEstimate, 350);
    const ev: EvidenceItem[] = [];
    if (metrics.bufferDays !== null) {
      ev.push({ label: "Buffer days", value: `${Math.round(metrics.bufferDays)} days of essentials covered` });
    }
    if (metrics.feeLeakage !== null && metrics.feeLeakage > 0) {
      ev.push({ label: "Fee leakage", value: `${(metrics.feeLeakage * 100).toFixed(1)}% of outflow` });
    }
    if (metrics.incomeVolatility !== null) {
      ev.push({ label: "Income volatility", value: `${Math.round(metrics.incomeVolatility * 100)}% (CV of monthly inflow)` });
    }
    if (metrics.fixedCommitmentRatio !== null) {
      ev.push({ label: "Fixed commitments", value: `${Math.round(metrics.fixedCommitmentRatio * 100)}% of income` });
    }
    if (ev.length >= 2) {
      const tightBuffer = metrics.bufferDays !== null && metrics.bufferDays < 7;
      out.push({
        insightType: "financial_health_metrics",
        severity: tightBuffer ? "warning" : "positive",
        title: tightBuffer
          ? `Your buffer covers only ${Math.round(metrics.bufferDays ?? 0)} days of essentials`
          : `Financial health: ${Math.round(metrics.bufferDays ?? 0)} days of essential-spend buffer`,
        body: tightBuffer
          ? `Your current balance would cover about ${Math.round(metrics.bufferDays ?? 0)} days of essential spending. The reference benchmark for irregular-income households is 14–28 days; building toward even a week materially reduces shortfall risk.`
          : `Your balance covers about ${Math.round(metrics.bufferDays ?? 0)} days of essential spending — a reasonable cushion for your income pattern. These standard metrics are computed from your history only.`,
        evidence: ev,
        options: [
          "Grow the buffer via pay-yourself-first",
          "Review recurring commitments",
          "Check the Sathi v1 summary endpoint for the full metric set",
        ],
      });
    }
  }

  return out;
}
