"use client";
/** Typed fetch helpers for the Sathi API. */

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

async function post<T>(url: string, body?: unknown, opts?: { method?: string; timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timer = opts?.timeoutMs
    ? setTimeout(() => controller.abort(), opts.timeoutMs)
    : undefined;
  try {
    const res = await fetch(url, {
      method: opts?.method ?? "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error((b as { error?: string }).error ?? `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

import type {
  FinancialSummary, SpendingIntelligence, ParsedExpense, Goal, GoalAnalysis,
  SimulateResult, CopilotAnswer, SafeToSpendResult, ShortfallRiskResult,
  CashOnHand, ForecastResult, ActionCard, RiskMetrics,
} from "@/lib/engine/domain";

export interface TxnRow {
  id: number;
  userId: number;
  timestamp: string;
  amount: number;
  currency: string;
  direction: "in" | "out";
  category: string;
  subcategory: string | null;
  merchant: string | null;
  channel: string;
  source: string;
  classificationConfidence: number;
}

export interface InsightRow {
  id: number;
  insightType: string;
  severity: "positive" | "info" | "warning" | "alert";
  title: string;
  body: string;
  evidenceJson: string;
  optionsJson: string;
  modelVersion: string;
  generatedAt: string;
}

export interface ForecastPayload {
  cashOnHand: CashOnHand;
  forecast: ForecastResult;
  risk: ShortfallRiskResult;
  safeToSpend: SafeToSpendResult;
  actions: ActionCard[];
  goal: Goal | null;
}

export interface ActionSimulation {
  actionId: string;
  freedMonthly: number;
  before: { shortfallProb: number; safeToSpend: number; dailyBudget: number };
  after: { shortfallProb: number; safeToSpend: number; dailyBudget: number };
  goalImpact: { monthsSaved: number | null; gapAfter: number | null };
}

export interface MetricsPayload {
  riskModel: RiskMetrics;
  forecastBacktest: { modelVersion: string; horizonDays: number; maeDailyOutflowBdt: number; mapePct: number; sampleDays: number; source?: "owner" | "synthetic-demo" };
  nlParser: { categoryAccuracy: number; amountAccuracy: number; cases: { text: string; expected: string; predicted: string; catOk: boolean; amtOk: boolean }[] };
  personaSanity: { saverRisk: number; unstableRisk: number; differentiated: boolean; saverMonthlyOut: number };
  dataGovernance: { synthetic: boolean; pii: string; splits: string };
  generatedAt: string;
}

export interface BootPayload {
  ok: boolean;
  needsOnboarding: boolean;
  user: { id: number; name: string; mode: "personal" | "demo" } | null;
}

export interface ManualTxnInput {
  amount: number;
  direction: "in" | "out";
  category: string;
  merchant?: string | null;
  timestamp?: string;
}

export interface TxnPatchInput {
  amount?: number;
  direction?: "in" | "out";
  category?: string;
  merchant?: string | null;
  timestamp?: string;
}

export interface GoalPatchInput {
  name?: string;
  targetAmount?: number;
  months?: number;
  savedSoFar?: number;
  status?: "active" | "achieved" | "dropped";
}

export const api = {
  boot: () => get<BootPayload>("/api/boot"),
  completeOnboarding: (body: { name: string; mode: "personal" | "demo"; salaryAmount?: number | null; salaryPayDay?: number | null; openingBalance?: number }) =>
    post<{ ok: boolean; user: { id: number; name: string; mode: string } }>("/api/onboarding", body),
  summary: () => get<FinancialSummary>("/api/summary"),
  transactions: (params?: { limit?: number; category?: string; direction?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.category) qs.set("category", params.category);
    if (params?.direction) qs.set("direction", params.direction);
    const s = qs.toString();
    return get<TxnRow[]>(`/api/transactions${s ? `?${s}` : ""}`);
  },
  parse: (text: string) => post<ParsedExpense>("/api/parse", { text }),
  addTransaction: (text: string, confirmed: boolean, categoryOverride?: string) =>
    post<{ saved: boolean; needsConfirmation: boolean; id?: number; parsed: ParsedExpense }>("/api/transactions", { text, confirmed, categoryOverride }),
  addManualTransaction: (body: ManualTxnInput) =>
    post<{ saved: boolean; id: number }>("/api/transactions/manual", body),
  updateTransaction: (id: number, body: TxnPatchInput) =>
    post<{ saved: boolean; id: number }>(`/api/transactions/${id}`, body, { method: "PATCH" }),
  deleteTransaction: (id: number) =>
    post<{ deleted: boolean; id: number }>(`/api/transactions/${id}`, undefined, { method: "DELETE" }),
  spending: () => get<SpendingIntelligence>("/api/spending"),
  forecast: (horizon = 7) => get<ForecastPayload>(`/api/forecast?horizon=${horizon}`),
  simulateAction: (body: { actionId?: string; extraMonthlySavings?: number; cutCategory?: string; cutPct?: number }) =>
    post<ActionSimulation>("/api/forecast", body),
  goals: () => get<Goal[]>("/api/goals"),
  createGoal: (body: { name: string; targetAmount: number; months: number; savedSoFar?: number }) =>
    post<{ id: number; goal: Goal }>("/api/goals", body),
  updateGoal: (id: number, body: GoalPatchInput) =>
    post<{ saved: boolean; goal: Goal }>(`/api/goals/${id}`, body, { method: "PATCH" }),
  deleteGoal: (id: number) =>
    post<{ deleted: boolean; id: number }>(`/api/goals/${id}`, undefined, { method: "DELETE" }),
  goalAnalysis: (goalId: number) => get<GoalAnalysis>(`/api/goals/analyze?goalId=${goalId}`),
  simulateGoal: (body: { goalId: number; extraMonthlySavings?: number; cutCategory?: string; cutPct?: number }) =>
    post<SimulateResult>("/api/goals/simulate", body),
  copilot: (question: string) => post<CopilotAnswer>("/api/copilot", { question }, { timeoutMs: 45_000 }),
  insights: () => get<InsightRow[]>("/api/insights"),
  refreshInsights: () => post<InsightRow[]>("/api/insights"),
  salary: () => get<{ salaryAmount: number | null; salaryPayDay: number | null; salaryMerchant: string | null; openingBalance: number; note: string }>("/api/salary"),
  updateSalary: (body: { salaryAmount?: number | null; salaryPayDay?: number | null }) =>
    post<{ salaryAmount: number | null; salaryPayDay: number | null }>("/api/salary", body),
  updateProfile: (body: { name?: string; preferredLanguage?: string; openingBalance?: number }) =>
    post<{ name: string; preferredLanguage: string; mode: string; openingBalance?: number }>("/api/user", body, { method: "PATCH" }),
  inputs: () => get<{
    cashOnHandTaka: number | null;
    incomeDay: number | null;
    rentAmountTaka: number | null;
    rentConfirmed: boolean;
    otherLiquidTaka: number | null;
    effectiveCashOnHandTaka: number;
    source: string;
  }>("/api/inputs"),
  updateInputs: (body: {
    cashOnHandTaka?: number;
    incomeDay?: number;
    rentAmountTaka?: number;
    rentConfirmed?: boolean;
    otherLiquidTaka?: number;
  }) => post<{ cashOnHandTaka: number | null }>("/api/inputs", body),
  resetAllData: () => post<{ ok: boolean; reset: boolean }>("/api/reset"),
  metrics: () => get<MetricsPayload>("/api/metrics"),
};

/** Invalidate every query that shows computed numbers after a data change. */
export const DATA_MUTATION_KEYS = ["transactions", "summary", "spending", "forecast", "insights", "goals", "metrics"] as const;
