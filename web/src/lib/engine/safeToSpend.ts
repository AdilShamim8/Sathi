/**
 * P0 — Safe-to-spend decision engine. Pure function. Ported from Sathi's
 * core/safe_to_spend.py (Python) to TypeScript.
 *
 *   Safe-to-Spend = Total Liquid Float
 *                   − (Upcoming Commitments + Safety Buffer + Prorated Savings)
 *
 * The customer sees a definitive, reliable figure:
 *   "Estimated safe-to-spend: ৳X" and "Shortfall risk in the next 7 days".
 */
import type { SafeToSpendResult, Txn } from "./domain";

export function calculateSafeToSpend(params: {
  walletBalance: number;
  upcomingCommitments: number; // recurring obligations due within the horizon
  dailyEssentials: number;
  horizonDays?: number;
  monthlySavingsTarget?: number;
  /** Physical cash-on-hand (behavioral estimate or user-declared, decayed). */
  cashOnHand?: number;
  /** Other explicitly supported liquid funds (user-declared). */
  otherLiquid?: number;
}): SafeToSpendResult {
  const {
    walletBalance,
    upcomingCommitments,
    dailyEssentials,
    horizonDays = 7,
    monthlySavingsTarget = 0,
    cashOnHand = 0,
    otherLiquid = 0,
  } = params;

  // Mission P0: liquidity = wallet + cash-on-hand + other liquid funds.
  const totalLiquid = Math.max(0, walletBalance) + Math.max(0, cashOnHand) + Math.max(0, otherLiquid);
  // Reserve at least 3 days of essentials as emergency cushion (min ৳1,000)
  const safetyBuffer = Math.max(dailyEssentials * 3, 1000);
  const proratedSavings = Math.round(monthlySavingsTarget * (horizonDays / 30));

  const protectedObligations = upcomingCommitments + safetyBuffer + proratedSavings;

  const safeTotal = Math.max(0, totalLiquid - protectedObligations);
  const safeWallet = Math.max(0, walletBalance - protectedObligations);
  const dailyBudget = Math.floor(safeTotal / Math.max(horizonDays, 1));

  let status: SafeToSpendResult["status"];
  let statusLabelEn: string;
  let statusLabelBn: string;
  let adviceEn: string;
  let adviceBn: string;

  const t = (n: number) => `৳${Math.round(n).toLocaleString()}`;

  if (totalLiquid < protectedObligations) {
    status = "deficit";
    statusLabelEn = "Deficit risk";
    statusLabelBn = "ঘাটতির ঝুঁকি";
    adviceEn = `Upcoming obligations exceed available funds in the next ${horizonDays} days. Defer discretionary spending.`;
    adviceBn = `সামনের ${horizonDays} দিনে আবশ্যক বিল ও খরচের তুলনায় তহবিলের ঘাটতি হতে পারে। অপ্রয়োজনীয় খরচ স্থগিত রাখুন।`;
  } else if (safeTotal < dailyEssentials * 2) {
    status = "tight";
    statusLabelEn = "Tight";
    statusLabelBn = "টানাটানি";
    adviceEn = `Spending capacity is narrow over the next ${horizonDays} days. Stick to essentials.`;
    adviceBn = `সামনের ${horizonDays} দিনে খরচের হাত টান রাখুন। নিরাপদ ব্যয়ের সীমা খুবই সীমিত।`;
  } else if (safeTotal < dailyEssentials * 7) {
    status = "cautious";
    statusLabelEn = "Cautious";
    statusLabelBn = "সতর্কতামূলক";
    adviceEn = `Spending up to ${t(dailyBudget)}/day maintains full financial stability.`;
    adviceBn = `দৈনিক সর্বোচ্চ ${t(dailyBudget)} খরচ করলে আগামী ${horizonDays} দিন কোনো টানাপোড়েন ছাড়াই চলবে।`;
  } else {
    status = "comfortable";
    statusLabelEn = "Comfortable";
    statusLabelBn = "স্বস্তিদায়ক";
    adviceEn = `Comfortable liquidity. You have approximately ${t(safeTotal)} available after all upcoming obligations.`;
    adviceBn = `আপনার তহবিল স্বাভাবিক। আসন্ন সব দায়দেনা মিটিয়েও প্রায় ${t(safeTotal)} ব্যয়ের সামর্থ্য রয়েছে।`;
  }

  return {
    safeToSpendTotal: safeTotal,
    safeToSpendWallet: safeWallet,
    dailySafeBudget: dailyBudget,
    upcomingCommitments: Math.round(upcomingCommitments),
    safetyBuffer: Math.round(safetyBuffer),
    proratedSavings: Math.round(proratedSavings),
    walletBalance: Math.round(walletBalance),
    cashOnHand: Math.round(Math.max(0, cashOnHand)),
    otherLiquid: Math.round(Math.max(0, otherLiquid)),
    horizonDays,
    status,
    statusLabelEn,
    statusLabelBn,
    adviceEn,
    adviceBn,
    breakdown: [
      { label: "Wallet + cash on hand + other liquid", amount: Math.round(totalLiquid) },
      { label: "Upcoming commitments (7d)", amount: -Math.round(upcomingCommitments) },
      { label: "Safety buffer", amount: -Math.round(safetyBuffer) },
      { label: "Prorated savings", amount: -Math.round(proratedSavings) },
      { label: "Safe to spend", amount: safeTotal },
    ],
  };
}

/**
 * Upcoming commitments within the horizon, learned from recurring expense
 * patterns in the transaction history (never from persona/config).
 */
export function upcomingCommitments(recurringOut: {
  cadence: string; avgAmount: number; typicalDayOfMonth: number | null; monthlyEstimate: number;
}[], anchor: Date, horizonDays = 7): number {
  const DAY = 24 * 3600 * 1000;
  let total = 0;
  const today = new Date(anchor);
  today.setHours(0, 0, 0, 0);
  for (const r of recurringOut) {
    if (r.cadence === "monthly" && r.typicalDayOfMonth !== null) {
      for (let h = 1; h <= horizonDays; h++) {
        const future = new Date(today.getTime() + h * DAY);
        if (future.getDate() === r.typicalDayOfMonth) { total += r.avgAmount; break; }
      }
    } else {
      // weekly/daily patterns: prorate the monthly estimate over the horizon
      total += (r.monthlyEstimate / 30) * horizonDays;
    }
  }
  return Math.round(total);
}

/* ---------------- model-based safe-to-spend (ML handoff port) ----------------
 * The deterministic formula above is the rule baseline; the value below is
 * what the LightGBM quantile forecaster produces. Both are kept so they can
 * be compared (docs/eval_report.md T2). Paisa in, paisa out, like the
 * reference core/safe_to_spend.py additions. */

import { percentile } from "./simulation";

/**
 * Model-based safe-to-spend: the largest amount that can be spent today
 * while the simulated wallet stays above `floorPaisa` on (1 - alpha) of the
 * paths, i.e. Q_alpha(min future balance) - floor, floored at 0.
 *
 * paths: (P, H+1) simulated balances, paisa; column 0 = today.
 */
export function safeToSpendFromPaths(pathsPaisa: number[][], floorPaisa: number, alpha = 0.1): number {
  const mins = pathsPaisa.map((p) => Math.min(...p.slice(1)));
  if (mins.length === 0) return 0;
  return Math.max(Math.trunc(percentile(mins, alpha * 100)) - Math.trunc(floorPaisa), 0);
}

const MODEL_STATUS_TEXT: Record<string, [string, string, string, string]> = {
  deficit: [
    "ঘাটতির ঝুঁকি",
    "Deficit Risk",
    "পরবর্তী আয়ের আগে ব্যালেন্স নিরাপদ সীমার নিচে নামার সম্ভাবনা বেশি। অপ্রয়োজনীয় খরচ স্থগিত রাখুন।",
    "Your balance is likely to dip below your safety floor before the next income. Defer discretionary spending.",
  ],
  tight: [
    "টানাটানি",
    "Tight",
    "পরবর্তী আয়ের আগে খরচের হাত টান রাখুন। নিরাপদ ব্যয়ের সীমা খুবই সীমিত।",
    "Spending room before the next income is narrow. Stick to essentials.",
  ],
  cautious: [
    "সতর্কতামূলক",
    "Cautious",
    "নিরাপদ সীমার মধ্যে খরচ করলে পরবর্তী আয় পর্যন্ত টানাপোড়েন হওয়ার সম্ভাবনা কম।",
    "Staying within the safe amount keeps a shortfall unlikely until the next income.",
  ],
  comfortable: [
    "স্বস্তিদায়ক",
    "Comfortable",
    "আপনার তহবিল স্বাভাবিক। আসন্ন বিল মিটিয়েও খরচের সুযোগ আছে।",
    "Comfortable liquidity, with room to spend after upcoming bills.",
  ],
};

/**
 * Status tuple for the model-based safe-to-spend, using the same day-multiples
 * as the rule (2 / 7 days of essentials), with an explicit deficit check on
 * the shortfall probability. Paisa in.
 */
export function modelStatus(
  safePaisa: number,
  dailyEssentialsPaisa: number,
  pShortfall: number,
): { status: string; labelBn: string; labelEn: string; adviceBn: string; adviceEn: string } {
  let status: string;
  if (safePaisa <= 0 && pShortfall >= 0.5) status = "deficit";
  else if (safePaisa < dailyEssentialsPaisa * 2) status = "tight";
  else if (safePaisa < dailyEssentialsPaisa * 7) status = "cautious";
  else status = "comfortable";
  const [labelBn, labelEn, adviceBn, adviceEn] = MODEL_STATUS_TEXT[status]!;
  return { status, labelBn, labelEn, adviceBn, adviceEn };
}
