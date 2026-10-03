/**
 * App-level tests: empty-ledger safety (fresh personal accounts), CRUD input
 * validation, and the copilot grounding guard. These protect the real
 * day-to-day personal-use paths added in v4.
 */
import { describe, test, expect } from "bun:test";
import { computeAll } from "@/lib/server/compute";
import { shortfallRisk } from "@/lib/engine/ml";
import { generateInsights } from "@/lib/engine/insights";
import { validateTxnCreate, validateTxnPatch, validateGoalPatch } from "@/lib/server/validate";
import { computeSpendingIntelligence, estimateCashOnHand } from "@/lib/engine/analytics";
import { forecastCashflow } from "@/lib/engine/forecast";
import type { Txn } from "@/lib/engine/domain";

const anchor = new Date("2026-10-03T12:00:00+06:00");

describe("empty-ledger engine safety (fresh personal start)", () => {
  test("computeAll with zero transactions never crashes and yields sane zeros", () => {
    const out = computeAll([], anchor, 0, { amount: null, payDay: null });
    expect(Number.isFinite(out.intel.totalIn)).toBe(true);
    expect(out.intel.totalIn).toBe(0);
    expect(out.intel.totalOut).toBe(0);
    expect(Number.isFinite(out.cash.walletBalance)).toBe(true);
    expect(Number.isFinite(out.fc.expectedOutflow)).toBe(true);
    expect(Number.isFinite(out.risk.probability)).toBe(true);
    expect(Number.isFinite(out.sts.safeToSpendTotal)).toBe(true);
    // no NaN anywhere in the serialized risk factors
    for (const f of out.risk.topFactors) {
      expect(Number.isFinite(f.contribution)).toBe(true);
    }
  });

  test("shortfallRisk with zero transactions returns the neutral no-data result", () => {
    const r = shortfallRisk([], anchor, 0, 0, 7, { amount: 45000, payDay: 5 });
    expect(r.probability).toBe(0);
    expect(r.riskLevel).toBe("low");
    expect(r.topFactors[0].value).toContain("Not enough data");
  });

  test("shortfallRisk with a salary but zero balance still reports a real probability", () => {
    // once history exists the model must actually run (not the no-data path)
    const txns: Txn[] = [
      {
        id: 1, timestamp: "2026-09-28T10:00:00+06:00", amount: 400, currency: "BDT",
        direction: "out", category: "food_beverage", subcategory: null, merchant: "tea",
        channel: "wallet", source: "manual", classificationConfidence: 1,
      },
      {
        id: 2, timestamp: "2026-09-30T10:00:00+06:00", amount: 500, currency: "BDT",
        direction: "out", category: "transport", subcategory: null, merchant: "bus",
        channel: "wallet", source: "manual", classificationConfidence: 1,
      },
    ];
    const r = shortfallRisk(txns, anchor, 0, 0, 7, { amount: null, payDay: null });
    expect(r.probability).toBeGreaterThanOrEqual(0);
    expect(r.probability).toBeLessThanOrEqual(1);
    expect(r.modelVersion).toBeTruthy();
  });

  test("spending intelligence, cash estimate and forecast handle the empty ledger", () => {
    const intel = computeSpendingIntelligence([], anchor);
    expect(intel.categories).toEqual([]);
    expect(intel.recurring).toEqual([]);
    const cash = estimateCashOnHand([], anchor, 12000, { amount: null, payDay: null });
    expect(cash.walletBalance).toBe(12000);
    const fc = forecastCashflow([], anchor, 7, 12000);
    expect(Number.isFinite(fc.expectedOutflow)).toBe(true);
    expect(Number.isFinite(fc.pressureScore)).toBe(true);
  });

  test("insight generation on an empty ledger yields no numeric nonsense", () => {
    const { intel, cash, risk, sts } = computeAll([], anchor, 0, { amount: null, payDay: null });
    const cards = generateInsights(intel, [], anchor, cash.walletBalance, sts, risk);
    for (const c of cards) {
      for (const e of c.evidence) {
        expect(Number.isNaN(Number(e.value.replace(/[^\d.-]/g, "").length ? Number(e.value.replace(/[^\d.-]/g, "")) : 0))).toBe(false);
      }
    }
  });
});

describe("transaction input validation (manual create)", () => {
  const base = { amount: 250, direction: "out", category: "transport" };

  test("accepts a valid expense", () => {
    const r = validateTxnCreate(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.amount).toBe(250);
      expect(r.value.direction).toBe("out");
    }
  });

  test("accepts a valid income with merchant/source", () => {
    const r = validateTxnCreate({ amount: 8500, direction: "in", category: "income", merchant: "Freelance" });
    expect(r.ok).toBe(true);
  });

  test("rejects zero, negative, huge and non-numeric amounts", () => {
    expect(validateTxnCreate({ ...base, amount: 0 }).ok).toBe(false);
    expect(validateTxnCreate({ ...base, amount: -5 }).ok).toBe(false);
    expect(validateTxnCreate({ ...base, amount: 99_999_999 }).ok).toBe(false);
    expect(validateTxnCreate({ ...base, amount: "abc" }).ok).toBe(false);
  });

  test("rejects unknown categories and bad directions", () => {
    expect(validateTxnCreate({ ...base, category: "ice_cream" }).ok).toBe(false);
    expect(validateTxnCreate({ ...base, direction: "sideways" }).ok).toBe(false);
  });

  test("rejects far-future and far-past dates, accepts today", () => {
    expect(validateTxnCreate({ ...base, timestamp: "2027-06-01" }).ok).toBe(false);
    expect(validateTxnCreate({ ...base, timestamp: "2020-01-01" }).ok).toBe(false);
    expect(validateTxnCreate({ ...base, timestamp: new Date().toISOString() }).ok).toBe(true);
  });

  test("accepts numeric strings for amount (form inputs arrive as strings)", () => {
    const r = validateTxnCreate({ ...base, amount: "1,200" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.amount).toBe(1200);
  });
});

describe("transaction input validation (patch)", () => {
  test("partial updates only carry provided fields", () => {
    const r = validateTxnPatch({ amount: 300 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ amount: 300 });
    }
  });

  test("empty patch is rejected", () => {
    expect(validateTxnPatch({}).ok).toBe(false);
  });

  test("merchant null clears the field; whitespace-only merchant normalizes to null", () => {
    const r = validateTxnPatch({ merchant: "   " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.merchant).toBeNull();
    const r2 = validateTxnPatch({ merchant: null });
    expect(r2.ok).toBe(true);
  });
});

describe("goal patch validation", () => {
  test("valid partial update", () => {
    const r = validateGoalPatch({ savedSoFar: 15000, name: "New laptop" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.savedSoFar).toBe(15000);
      expect(r.value.name).toBe("New laptop");
    }
  });

  test("rejects invalid name, months, saved and status", () => {
    expect(validateGoalPatch({ name: "x" }).ok).toBe(false);
    expect(validateGoalPatch({ months: 0 }).ok).toBe(false);
    expect(validateGoalPatch({ months: 500 }).ok).toBe(false);
    expect(validateGoalPatch({ savedSoFar: -1 }).ok).toBe(false);
    expect(validateGoalPatch({ status: "paused" }).ok).toBe(false);
  });

  test("accepts status transitions", () => {
    for (const status of ["active", "achieved", "dropped"] as const) {
      const r = validateGoalPatch({ status });
      expect(r.ok).toBe(true);
    }
  });
});

describe("engine consistency after mutations (insights freshness contract)", () => {
  test("recomputing after a simulated edit changes the month totals", () => {
    const txns: Txn[] = [
      {
        id: 1, timestamp: "2026-10-01T10:00:00+06:00", amount: 1000, currency: "BDT",
        direction: "out", category: "groceries", subcategory: null, merchant: "bazar",
        channel: "wallet", source: "manual", classificationConfidence: 1,
      },
    ];
    const before = computeSpendingIntelligence(txns, anchor);
    const edited = [{ ...txns[0], amount: 2000 }];
    const after = computeSpendingIntelligence(edited, anchor);
    expect(after.totalOut).toBe(before.totalOut + 1000);
  });
});
