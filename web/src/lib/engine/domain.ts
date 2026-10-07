/**
 * Sathi — shared domain contracts.
 * Ported from the first-version copilot and extended with the cash-flow
 * intelligence layer (cash-on-hand, safe-to-spend, ML shortfall risk).
 * All money values are integer BDT (whole taka) computed by deterministic
 * engines — the LLM never produces numbers.
 */

export const MODEL_VERSION = "sathi-copilot-v2.0";
export const FORECAST_MODEL_VERSION = "forecast-dayofmonth-v1.1";
export const RISK_MODEL_VERSION = "shortfall-logreg-v1.0";

export type Direction = "in" | "out";
export type Pressure = "low" | "medium" | "high";
export type Severity = "positive" | "info" | "warning" | "alert";
export type Confidence = "low" | "medium" | "high";
export type Lang = "en" | "bn";

/* ---------------- categories (deterministic keyword classifier) ---------------- */

export interface CategoryDef {
  id: string;
  labelEn: string;
  labelBn: string;
  keywords: string[];
  discretionary?: boolean;
  /** essentials feed the safe-to-spend daily-essential estimate */
  essential: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { id: "income", labelEn: "Income", labelBn: "আয়", essential: false, keywords: ["salary", "বেতন", "income", "আয়", "cash in", "ক্যাশ ইন", "received", "পেয়েছি", "পেলাম"] },
  { id: "food_beverage", labelEn: "Food & Beverage", labelBn: "খাদ্য ও পানীয়", essential: true, keywords: ["coffee", "কফি", "restaurant", "রেস্টুরেন্ট", "food", "খাবার", "খাইছি", "খেয়েছি", "lunch", "dinner", "breakfast", "cha", "চা", "snack", "নাস্তা", "biryani", "বিরিয়ানি", "cafe", "ক্যাফে"] },
  { id: "groceries", labelEn: "Groceries", labelBn: "মুদি বাজার", essential: true, keywords: ["grocery", "groceries", "বাজার", "মুদি", "supermarket", "সবজি", "vegetable", "মাছ", "fish", "মাংস", "meat", "chaal", "চাল", "rice", "bajar", "bazar"] },
  { id: "transport", labelEn: "Transport", labelBn: "যাতায়াত", essential: true, keywords: ["rickshaw", "রিকশা", "bus", "বাস", "uber", "pathao", "পাঠাও", "cng", "সিএনজি", "fare", "ভাড়া", "transport", "যাতায়াত", "metro", "মেট্রো", "fuel", "পেট্রোল"] },
  { id: "housing", labelEn: "Housing & Rent", labelBn: "বাসা ভাড়া", essential: true, keywords: ["rent", "ভাড়া", "house rent", "বাসা", "হাউজ", "landlord", "বাড়িওয়ালা"] },
  { id: "utilities", labelEn: "Utilities & Bills", labelBn: "ইউটিলিটি বিল", essential: true, keywords: ["electricity", "বিদ্যুৎ", "gas", "গ্যাস", "water", "পানি", "bill", "বিল", "internet", "ইন্টারনেট", "wifi", "ওয়াইফাই"] },
  { id: "mobile_topup", labelEn: "Mobile Recharge", labelBn: "মোবাইল রিচার্জ", essential: true, keywords: ["recharge", "রিচার্জ", "topup", "top-up", "টপআপ", "flexiload", "ফ্লেক্সিলোড", "mobile balance", "মোবাইল"] },
  { id: "cash_out", labelEn: "Cash Out", labelBn: "ক্যাশ আউট", essential: false, keywords: ["cash out", "cashout", "ক্যাশ আউট", "ক্যাশআউট", "withdraw", "উত্তোলন", "তুললাম", "তুলেছি", "atm"] },
  { id: "shopping", labelEn: "Shopping", labelBn: "কেনাকাটা", essential: false, keywords: ["shopping", "কেনাকাটা", "clothes", "জামা", "কাপড়", "daraz", "দারাজ", "shoes", "জুতা", "gift", "উপহার", "gadget", "গ্যাজেট"] },
  { id: "health", labelEn: "Health", labelBn: "স্বাস্থ্য", essential: true, keywords: ["medicine", "ঔষধ", "ওষুধ", "doctor", "ডাক্তার", "pharmacy", "ফার্মেসি", "hospital", "হাসপাতাল", "test", "পরীক্ষা"] },
  { id: "education", labelEn: "Education", labelBn: "শিক্ষা", essential: true, keywords: ["course", "কোর্স", "book", "বই", "tuition", "টিউশন", "exam", "পরীক্ষার ফি", "শিক্ষা", "udemy"] },
  { id: "entertainment", labelEn: "Entertainment", labelBn: "বিনোদন", essential: false, keywords: ["movie", "সিনেমা", "netflix", "নেটফ্লিক্স", "game", "গেম", "spotify", "concert", "কনসার্ট", "subscription", "সাবস্ক্রিপশন", "hoichoi", "chorki"] },
  { id: "send_money", labelEn: "Send Money / Family", labelBn: "টাকা পাঠানো", essential: true, keywords: ["send money", "সেন্ড মানি", "পাঠিয়েছি", "পাঠালাম", "family", "পরিবার", "আম্মু", "আব্বু", "বাবা", "মা", "bhai", "ভাই"] },
  { id: "savings", labelEn: "Savings", labelBn: "সঞ্চয়", essential: false, keywords: ["savings", "সঞ্চয়", "save", "জমালাম", "dps", "ডিপিএস", "deposit", "জমা"] },
];

export const OTHER_CATEGORY: CategoryDef = {
  id: "other", labelEn: "Other", labelBn: "অন্যান্য", keywords: [], discretionary: true, essential: false,
};

export const ALL_CATEGORIES = [...CATEGORIES, OTHER_CATEGORY];

export function categoryLabel(id: string, lang: Lang = "en"): string {
  const c = ALL_CATEGORIES.find((x) => x.id === id);
  if (!c) return id;
  return lang === "bn" ? c.labelBn : c.labelEn;
}

/* ---------------- engine payload shapes ---------------- */

export interface CategoryStat {
  category: string; labelEn: string; labelBn: string;
  thisMonth: number; lastMonth: number; changePct: number | null;
  share: number; txCount: number; avgAmount: number;
}

export interface RecurringPattern {
  key: string;
  label: string;
  category: string;
  direction: Direction;
  merchant: string | null;
  occurrences: number;
  avgAmount: number;
  cadence: "daily-ish" | "several times a week" | "weekly" | "monthly";
  monthlyEstimate: number;
  /** modal day-of-month when cadence is monthly, else null */
  typicalDayOfMonth: number | null;
}

export interface SpendingIntelligence {
  periodDays: number;
  totalIn: number; totalOut: number; net: number;
  lastMonthIn: number; lastMonthOut: number;
  categories: CategoryStat[];
  recurring: RecurringPattern[];
  recurringIncome: RecurringPattern[];
  cashOut: { count: number; total: number; shareOfOutflow: number };
  monthEndPattern: { lateOutflow: number; lateInflow: number; lateShare: number; drySpell: boolean };
  concentration: { topCategory: string; topShare: number };
  anomalies: { id: number; timestamp: string; amount: number; category: string; merchant: string | null; zScore: number; reason: string }[];
  dailyEssentials: number;
}

export interface ForecastResult {
  generatedAt: string;
  horizonDays: number;
  expectedInflow: number;
  expectedOutflow: number;
  net: number;
  lowerBound: number;
  upperBound: number;
  pressure: Pressure;
  pressureScore: number;
  factors: string[];
  dailySeries: { day: string; expectedOutflow: number; expectedInflow: number; cumNet: number }[];
  assumptions: string[];
  confidence: Confidence;
  modelVersion: string;
  periodAnalyzed: string;
}

/** P0: cash-on-hand (liquid float) estimation */
export interface CashOnHand {
  walletBalance: number;
  /** recurring inflows detected in the trailing 90 days (avg per month) */
  avgMonthlyIncome: number;
  /** how many days until the next detected salary-like inflow */
  daysToNextIncome: number | null;
  nextIncomeDate: string | null;
  nextIncomeEstimate: number;
  salaryDetectedFromHistory: boolean;
  dailyEssentials: number;
  basis: string;
}

/** P0: safe-to-spend result (deterministic engine) */
export interface SafeToSpendResult {
  safeToSpendTotal: number;
  safeToSpendWallet: number;
  dailySafeBudget: number;
  upcomingCommitments: number;
  safetyBuffer: number;
  proratedSavings: number;
  walletBalance: number;
  /** Physical cash-on-hand included in total liquidity. */
  cashOnHand: number;
  /** Other user-declared liquid funds included in total liquidity. */
  otherLiquid: number;
  horizonDays: number;
  status: "comfortable" | "cautious" | "tight" | "deficit";
  statusLabelEn: string;
  statusLabelBn: string;
  adviceEn: string;
  adviceBn: string;
  breakdown: { label: string; amount: number }[];
}

/** P0: ML shortfall risk for the next N days */
export interface ShortfallRiskResult {
  probability: number; // 0..1 — P(balance dips below safety line within horizon)
  riskLevel: "low" | "medium" | "high";
  modelVersion: string;
  baselineRuleProbability: number; // what the simple rule would say (for transparency)
  topFactors: { label: string; value: string; contribution: number }[];
  troughDay: string | null;
  projectedTrough: number;
  expectedMinBalance: number;
}

export interface GoalAnalysis {
  goalId: number; name: string; targetAmount: number; targetDate: string;
  monthsRemaining: number; requiredMonthly: number; currentCapacity: number; capacityBasis: string;
  projectedTotal: number; projectedGap: number; progressPct: number;
  feasibility: "on_track" | "tight" | "needs_adjustment";
  scenarios: GoalScenario[];
  assumptions: string[];
}

export interface GoalScenario {
  id: string; title: string; description: string;
  monthlyContribution: number; months: number; projectedTotal: number; gap: number; reachesGoal: boolean;
}

export interface SimulateResult {
  extraMonthlySavings?: number; cutCategory?: string; cutPct?: number;
  freedMonthly: number; newCapacity: number; projectedTotal: number; projectedGap: number;
  monthsToGoal: number | null; monthsSaved: number | null;
  tradeoffs: string[]; assumptions: string[];
}

/** P1: actions & simulation */
export interface ActionCard {
  id: string;
  titleEn: string; titleBn: string;
  description: string;
  rationale: string;
  category: "cashflow" | "goal" | "habits";
  simulated: {
    freedMonthly: number;
    shortfallProbBefore: number;
    shortfallProbAfter: number;
    safeToSpendAfter: number;
    goalMonthsSaved: number | null;
    goalGapAfter: number | null;
  };
  tradeoff: string;
}

export interface EvidenceItem { label: string; value: string }
export interface CopilotOption { title: string; description: string; impact: string }

export interface CopilotAnswer {
  intent: string;
  summary: string;
  evidence: EvidenceItem[];
  numbers: EvidenceItem[];
  options: CopilotOption[];
  assumptions: string[];
  confidence: Confidence;
  disclaimer: string;
  knowledgeRefs: string[];
  llmEnhanced: boolean;
  aiStatus?: import("./aiStatus").AIStatus;
}

export interface FinancialSummary {
  user: { id: number; name: string; preferredLanguage: string; salaryAmount: number | null; salaryPayDay: number | null; mode: "personal" | "demo" };
  month: { inflow: number; outflow: number; estSavings: number };
  lastMonth: { inflow: number; outflow: number };
  savingsChangePct: number | null;
  balanceEstimate: number;
  goalProgress: { name: string; pct: number; target: number; saved: number } | null;
  cashflowPressure: Pressure;
  shortfallRisk: number;
  safeToSpend: SafeToSpendResult;
  topInsight: { title: string; body: string; severity: Severity } | null;
  generatedAt: string;
}

export interface ParsedExpense {
  amount: number | null;
  currency: string;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  date: string;
  direction: Direction;
  language: "bn" | "en" | "banglish";
  confidence: number;
  rawText: string;
  notes: string[];
}

/* ---------------- transaction runtime shape (serialized) ---------------- */

export interface Txn {
  id: number;
  timestamp: string;
  amount: number;
  currency: string;
  direction: Direction;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  channel: string;
  source: string;
  classificationConfidence: number;
}

export interface Goal {
  id: number; name: string; targetAmount: number; targetDate: string;
  savedSoFar: number; monthlyCommitment: number; status: string;
}

/* ---------------- ML validation metrics (P0) ---------------- */

export interface CalibrationBin { lo: number; hi: number; n: number; meanPred: number; obsRate: number }

export interface RiskMetrics {
  modelVersion: string;
  trainedOn: { users: number; days: number; positives: number };
  testedOn: { users: number; days: number; positives: number };
  ml: { brier: number; prAuc: number; auc: number; reliability: CalibrationBin[] };
  ruleBaseline: { brier: number; prAuc: number; auc: number; description: string };
  climatology: { brier: number };
  brierSkillScoreVsRule: number;
  brierSkillScoreVsClimatology: number;
  coefficients: { feature: string; weight: number }[];
  featureNames: string[];
}
