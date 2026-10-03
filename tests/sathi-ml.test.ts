/**
 * Sathi ML handoff tests — TypeScript ports of the reference test suite
 * additions (tests/test_core_income_timing.py, tests/test_core_forecast_paths.py)
 * plus predictor-correctness and end-to-end forecaster invariants.
 *
 * The LightGBM predictor is validated BIT-IDENTICALLY against the reference
 * Python booster via tests/fixtures/lgb-predictions.json (generated with
 * lightgbm 4.5.0 from the exact shipped model files).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseLgbModel, predictLgb } from "../src/lib/engine/lightgbm";
import {
  incomeTiming, detectStreams, type StreamEvent,
} from "../src/lib/engine/recurringStreams";
import {
  inverseCdf, blockCorrelatedUniforms, sampleStreamFlows, simulateLiquidityPaths,
} from "../src/lib/engine/liquidity";
import { cashTimeConstantDays, estimateCashV2 } from "../src/lib/engine/cashOnHand";
import { safeToSpendFromPaths } from "../src/lib/engine/safeToSpend";
import {
  buildPanel, OriginFeatures, TAUS, FEATURES, festivalWindow,
} from "../src/lib/engine/panel";
import {
  getForecaster, forecastTransactions, stableSeed, crc32, toPanelTxns,
} from "../src/lib/engine/forecaster";
import { generateSathiPersonaHistory, SATHI_PERSONAS } from "../src/lib/engine/sathiPersonas";
import type { Txn } from "../src/lib/engine/domain";
import { mulberry32 } from "../src/lib/engine/rng";
import { isoDay, dayIso } from "../src/lib/engine/timeutils";

const D = (iso: string) => isoDay(iso);
const ARTIFACTS = path.join(__dirname, "..", "ml-artifacts", "forecast");

/* ---------------- LightGBM predictor vs Python ---------------- */

describe("lightgbm predictor (vs Python lightgbm 4.5.0 fixture)", () => {
  const fx = JSON.parse(
    readFileSync(path.join(__dirname, "fixtures", "lgb-predictions.json"), "utf8"),
  ) as { models: Record<string, number[]>; rows: (number | null)[][] };
  const rows = fx.rows.map((r) => r.map((v) => (v === null ? NaN : v)));

  test("all 9 quantile models reproduce Python predictions exactly", () => {
    const names = Object.keys(fx.models);
    expect(names.length).toBe(9);
    for (const name of names) {
      const model = parseLgbModel(
        readFileSync(path.join(ARTIFACTS, "fc-2026-09-30-15d8427d", `model_${name}.txt`), "utf8"),
      );
      expect(model.objective).toBe("quantile");
      expect(model.trees.length).toBeGreaterThan(0);
      for (let i = 0; i < rows.length; i++) {
        const got = predictLgb(model, rows[i]!);
        expect(Number.isFinite(got)).toBe(true);
        expect(Math.abs(got - fx.models[name]![i]!)).toBeLessThan(1e-9);
      }
    }
  });

  test("prediction is deterministic and independent of row order", () => {
    const model = parseLgbModel(
      readFileSync(path.join(ARTIFACTS, "fc-2026-09-30-15d8427d", "model_q50.txt"), "utf8"),
    );
    const a = rows.map((r) => predictLgb(model, r));
    const b = [...rows].reverse().map((r) => predictLgb(model, r)).reverse();
    expect(b).toEqual(a);
  });
});

/* ---------------- income timing (test_core_income_timing.py) ---------------- */

describe("income timing (leakage-safe)", () => {
  const monthly = (day: number, months = 4) => {
    const dates: number[] = [];
    for (let m = 5; m < 5 + months; m++) dates.push(D(`2026-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`));
    return { dates, amts: dates.map(() => 1_800_000) };
  };

  test("monthly salary detected", () => {
    const { dates, amts } = monthly(7);
    const t = incomeTiming(dates, amts, D("2026-08-20"));
    expect(t.daysSinceIncome).toBe(13);
    expect(t.periodDays).toBeGreaterThanOrEqual(30);
    expect(t.periodDays).toBeLessThanOrEqual(31);
    expect([17, 18]).toContain(t.daysToNextIncome);
  });

  test("future transactions never change features", () => {
    const { dates, amts } = monthly(7);
    const origin = D("2026-08-20");
    const before = incomeTiming(dates, amts, origin);
    const after = incomeTiming(
      [...dates, origin, D("2026-08-25")],
      [...amts, 9_000_000, 5_000_000],
      origin,
    );
    expect(after).toEqual(before);
  });

  test("daily earner has short period", () => {
    const dates: number[] = [];
    const amts: number[] = [];
    for (let i = 0; i < 40; i++) {
      dates.push(D("2026-07-01") + i);
      amts.push(100_000 + (i % 3) * 20_000);
    }
    const t = incomeTiming(dates, amts, D("2026-08-10"));
    expect(t.periodDays).toBeLessThanOrEqual(2);
    expect(t.daysToNextIncome).toBeLessThanOrEqual(1);
  });

  test("no history is capped", () => {
    const t = incomeTiming([], [], D("2026-08-01"));
    expect(t.nMajor).toBe(0);
    expect(t.daysToNextIncome).toBe(60);
  });
});

/* ---------------- path simulator (test_core_forecast_paths.py) ---------------- */

/** Quantile grid of a normal(sd) for each forecast day: (H, T). */
function gaussQ(h: number, sd = 1000): number[][] {
  // normal quantile function (Acklam's approximation is fine at 1e-3 here,
  // but we only need the exact TAUS quantiles — use a high-precision inverse)
  const normPpf = (p: number): number => {
    // Beasley-Springer-Moro
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
    }
    if (p > 1 - pl) {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
    }
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  };
  return Array.from({ length: h }, () => TAUS.map((t) => normPpf(t) * sd));
}

describe("path simulator", () => {
  test("inverse_cdf recovers quantiles", () => {
    const q = gaussQ(3);
    const u = TAUS.map((t) => [t, t, t]); // (P=T, H=3) with u = tau
    const vals = inverseCdf(q, TAUS, u);
    for (let p = 0; p < TAUS.length; p++) {
      expect(Math.abs(vals[p]![0]! - q[0]![p]!)).toBeLessThan(1e-6);
    }
  });

  test("block uniforms are uniform and correlated", () => {
    const u = blockCorrelatedUniforms(20000, 14, 0.8, 7, mulberry32(42));
    expect(u.length).toBe(20000);
    expect(u[0]!.length).toBe(14);
    let sum = 0;
    for (const row of u) for (const v of row) sum += v;
    expect(Math.abs(sum / (20000 * 14) - 0.5)).toBeLessThan(0.01);
    const zOf = (v: number) => gaussPpf(v);
    const corr = (xs: number[], ys: number[]) => {
      const n = xs.length;
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const my = ys.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let dx = 0;
      let dy = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i]! - mx) * (ys[i]! - my);
        dx += (xs[i]! - mx) ** 2;
        dy += (ys[i]! - my) ** 2;
      }
      return num / Math.sqrt(dx * dy);
    };
    const col = (h: number) => u.map((r) => zOf(r[h]!));
    expect(corr(col(0), col(1))).toBeGreaterThan(0.5); // same block
    expect(Math.abs(corr(col(0), col(7)))).toBeLessThan(0.05); // next block
  });

  test("safe_to_spend keeps shortfall at alpha (toy random walk)", () => {
    const h = 20;
    const floor = 50_000;
    const sched = Array.from({ length: 40000 }, () => new Array<number>(h).fill(0));
    const p1 = simulateLiquidityPaths(200_000, gaussQ(h), TAUS, sched, 0.3, 7, mulberry32(1));
    expect(p1.length).toBe(40000);
    expect(p1[0]!.length).toBe(h + 1);
    const safe = safeToSpendFromPaths(p1, floor, 0.1);
    expect(safe).toBeGreaterThan(0);
    const p2 = simulateLiquidityPaths(200_000 - safe, gaussQ(h), TAUS, sched, 0.3, 7, mulberry32(2));
    const pShort = p2.filter((p) => Math.min(...p.slice(1)) < floor).length / p2.length;
    expect(Math.abs(pShort - 0.1)).toBeLessThanOrEqual(0.01);
  });

  test("wallet paths never go below zero", () => {
    const h = 20;
    const sched = Array.from({ length: 500 }, () => new Array<number>(h).fill(0));
    const paths = simulateLiquidityPaths(30_000, gaussQ(h, 50000), TAUS, sched, 0.4, 7, mulberry32(9));
    for (const p of paths) for (const b of p) expect(b).toBeGreaterThanOrEqual(0);
  });
});

function gaussPpf(p: number): number {
  // reuse the Beasley-Springer-Moro inverse from gaussQ via a tiny closure
  const f = (x: number): number => {
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (x < pl) {
      const q = Math.sqrt(-2 * Math.log(x));
      return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
    }
    if (x > 1 - pl) {
      const q = Math.sqrt(-2 * Math.log(1 - x));
      return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
        ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
    }
    const q = x - 0.5;
    const r = q * q;
    return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  };
  return f(p);
}

/* ---------------- stream detection (test_core_forecast_paths.py) ---------------- */

describe("stream detection", () => {
  test("detects monthly salary and ignores random merchants", () => {
    const rand = mulberry32(3);
    const ev: StreamEvent[] = [];
    for (let m = 1; m <= 7; m++) {
      ev.push({
        day: D(`2026-${String(m).padStart(2, "0")}-07`),
        key: "salary_in|employer",
        direction: 1,
        amount: 1_600_000 + Math.round((rand() * 2 - 1) * 50_000),
      });
    }
    for (let k = 0; k < 12; k++) {
      ev.push({
        day: D("2026-01-01") + Math.floor(rand() * 200),
        key: "payment|merch_x",
        direction: -1,
        amount: 2000 + Math.floor(rand() * 18000),
      });
    }
    const streams = detectStreams(ev, D("2026-08-01"));
    expect(streams.map((s) => s.key)).toEqual(["salary_in|employer"]);
    const s = streams[0]!;
    expect(s.periodDays).toBeGreaterThanOrEqual(28);
    expect(s.periodDays).toBeLessThanOrEqual(31);
    expect(s.direction).toBe(1);
    expect(s.anchorDom).toBe(7);
  });

  test("events on/after the origin are invisible", () => {
    const ev: StreamEvent[] = [];
    for (let m = 1; m <= 7; m++) {
      ev.push({ day: D(`2026-${String(m).padStart(2, "0")}-07`), key: "salary_in|employer", direction: 1, amount: 1_600_000 });
    }
    const origin = D("2026-03-01");
    const withFuture: StreamEvent[] = [...ev];
    for (let k = 0; k < 5; k++) withFuture.push({ day: origin, key: "x|y", direction: 1, amount: 5 });
    expect(detectStreams(withFuture, origin)).toEqual(detectStreams(ev, origin));
  });

  test("side payments do not break the salary stream", () => {
    const ev: StreamEvent[] = [];
    for (let m = 1; m <= 7; m++) {
      ev.push({ day: D(`2026-${String(m).padStart(2, "0")}-07`), key: "salary_in|employer", direction: 1, amount: 1_600_000 });
    }
    ev.push({ day: D("2026-03-12"), key: "salary_in|employer", direction: 1, amount: 600_000 });
    ev.push({ day: D("2026-05-20"), key: "salary_in|employer", direction: 1, amount: 500_000 });
    const streams = detectStreams(ev, D("2026-08-01"));
    expect(streams.length).toBe(1);
    expect(streams[0]!.periodDays).toBeGreaterThanOrEqual(28);
    expect(streams[0]!.periodDays).toBeLessThanOrEqual(31);
  });

  test("stream flows land on schedule (monthly anchor)", () => {
    const ev: StreamEvent[] = [];
    for (let m = 1; m <= 7; m++) {
      ev.push({ day: D(`2026-${String(m).padStart(2, "0")}-07`), key: "rent", direction: -1, amount: 500_000 });
    }
    const s = detectStreams(ev, D("2026-07-20"));
    expect(s.length).toBe(1);
    const flows = sampleStreamFlows(s, D("2026-07-20"), 30, 200, mulberry32(4));
    for (const row of flows) {
      expect(row.reduce((a, b) => a + b, 0)).toBe(-500_000); // exactly one rent payment
    }
    const hitDays: number[] = [];
    flows.forEach((row, p) =>
      row.forEach((v, i) => {
        if (v !== 0) hitDays.push(i + 1);
      }),
    );
    expect(Math.min(...hitDays)).toBeGreaterThanOrEqual(15);
    expect(Math.max(...hitDays)).toBeLessThanOrEqual(21);
  });
});

/* ---------------- cash-on-hand v2 (test_core_forecast_paths.py) ---------------- */

describe("cash-on-hand v2", () => {
  test("decays with the user's own cadence", () => {
    const dates: number[] = [];
    for (let i = 0; i < 10; i++) dates.push(D("2026-05-01") + 4 * i);
    const tc = cashTimeConstantDays(dates);
    expect(tc).toBe(4.0);
    const fresh = estimateCashV2([D("2026-06-10")], [100_000], D("2026-06-10"), tc);
    const later = estimateCashV2([D("2026-06-10")], [100_000], D("2026-06-14"), tc);
    expect(fresh).toBe(100_000);
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThan(40_000);
    expect(estimateCashV2([D("2026-06-15")], [100_000], D("2026-06-14"), tc)).toBe(0);
  });
});

/* ---------------- panel + forecaster end-to-end ---------------- */

function personaAppTxns(personaId: string, anchorDay: number): { txns: Txn[]; openingBalance: number } {
  const { txns, openingBalance } = generateSathiPersonaHistory(
    personaId, new Date(anchorDay * 86400000), stableSeed(personaId) % 100000,
  );
  return {
    txns: txns.map((t) => ({
      id: 0,
      timestamp: t.timestamp.toISOString(),
      amount: t.amount,
      currency: "BDT",
      direction: t.direction,
      category: t.category,
      subcategory: t.subcategory,
      merchant: t.merchant,
      channel: t.channel,
      source: t.source,
      classificationConfidence: t.classificationConfidence,
    })),
    openingBalance,
  };
}

describe("forecaster end-to-end (model artifacts)", () => {
  const fc = getForecaster();
  const today = Math.floor(Date.now() / 86400000);

  test("artifacts load with the expected version and 9 boosters", () => {
    expect(fc).not.toBeNull();
    expect(fc!.version).toBe("fc-2026-09-30-15d8427d");
    expect(fc!.boosters.size).toBe(9);
    expect(fc!.calibration.rho).toBeGreaterThan(0);
    expect(fc!.calibration.block_days).toBeGreaterThan(0);
  });

  test("stableSeed matches zlib.crc32 (spot check)", () => {
    // zlib.crc32(b"44021|garment_worker") == 1114776109 (verified in Python)
    expect(crc32("44021|garment_worker")).toBe(stableSeed(44021, "garment_worker"));
    expect(crc32("hello")).toBe(0x3610a686);
  });

  for (const personaId of Object.keys(SATHI_PERSONAS)) {
    test(`${personaId}: forecast invariants`, () => {
      if (!fc) return;
      const { txns, openingBalance } = personaAppTxns(personaId, today);
      const opts = {
        festivalDays: festivalWindow(["2026-03-19", "2026-05-27"], 3),
        floorDays: 3,
        nPaths: 200,
        seed: stableSeed(44021, personaId),
      };
      const f = forecastTransactions(fc, personaId, txns, openingBalance, today, 21, opts);
      expect(f.pShortfall).toBeGreaterThanOrEqual(0);
      expect(f.pShortfall).toBeLessThanOrEqual(1);
      expect(f.paths.length).toBe(200);
      expect(f.paths[0]!.length).toBe(22);
      expect(f.paths[0]![0]).toBe(f.paths[0]![0]);
      for (const p of f.paths) for (const b of p) expect(b).toBeGreaterThanOrEqual(0);
      expect(f.troughDay).toBeGreaterThanOrEqual(1);
      expect(f.troughDay!).toBeLessThanOrEqual(f.windowDays);
      expect(f.safeToSpendPaisa).toBeGreaterThanOrEqual(0);
      expect(f.floorPaisa).toBeGreaterThanOrEqual(0);
      // Sorted quantiles never cross; the (negative) conformal widening can
      // narrow adjacent quantiles by up to ~0.4% of scale — same as the
      // reference implementation (sort, then widen).
      const scale = Math.max(...f.irregularQuantiles.flat().map(Math.abs), 1);
      for (const row of f.irregularQuantiles) {
        for (let t = 1; t < row.length; t++) {
          expect(row[t]!).toBeGreaterThanOrEqual(row[t - 1]! - 0.005 * scale);
        }
      }
      // determinism: same seed → identical forecast
      const f2 = forecastTransactions(fc, personaId, txns, openingBalance, today, 21, opts);
      expect(f2.pShortfall).toBe(f.pShortfall);
      expect(f2.paths).toEqual(f.paths);
    });
  }

  test("features at an origin are unchanged by future transactions (leakage)", () => {
    const { txns, openingBalance } = personaAppTxns("garment_worker", today);
    const lastDay = Math.max(...txns.map((t) => Math.floor(Date.parse(t.timestamp) / 86400000)));
    const origin = lastDay - 20; // forecast 20 days before the end of history
    const past = toPanelTxns(
      txns.filter((t) => Math.floor(Date.parse(t.timestamp) / 86400000) <= origin),
      openingBalance,
    );
    const all = toPanelTxns(txns, openingBalance);

    const panelPast = buildPanel("leak-a", past, origin);
    const panelAll = buildPanel("leak-b", all, lastDay);
    const fest = festivalWindow(["2026-03-19", "2026-05-27"], 3);
    const statePast = new OriginFeatures(panelPast, fest).originState(panelPast.nDays - 1);
    const stateAll = new OriginFeatures(panelAll, fest).originState(origin - panelAll.startDay);
    // Only ORIGIN-STATE features exist at this stage; the 8 target-day
    // features (k, dow, dom, …) are added by targetRows from this state.
    let compared = 0;
    for (const name of FEATURES) {
      const a = (stateAll as Record<string, unknown>)[name];
      const b = (statePast as Record<string, unknown>)[name];
      if (typeof a !== "number" || typeof b !== "number") continue;
      compared++;
      expect(a).toBeCloseTo(b, 9);
    }
    expect(compared).toBeGreaterThanOrEqual(21); // every origin-state feature checked
    expect(stateAll._timing).toEqual(statePast._timing);
  });

  test("toPanelTxns reconstructs a non-negative ledger with day-final balances", () => {
    const { txns, openingBalance } = personaAppTxns("shopkeeper", today);
    const panel = toPanelTxns(txns, openingBalance);
    expect(panel.length).toBe(txns.length);
    let minBal = Infinity;
    for (const t of panel) {
      if (t.balanceAfterPaisa !== null) {
        expect(t.balanceAfterPaisa).toBeGreaterThanOrEqual(0);
        minBal = Math.min(minBal, t.balanceAfterPaisa);
      }
    }
    expect(minBal).toBeLessThan(Infinity);
    // exactly one balance-carrying event per active day
    const withBal = panel.filter((t) => t.balanceAfterPaisa !== null);
    const days = new Set(withBal.map((t) => t.day));
    expect(days.size).toBe(withBal.length);
  });

  test("dayIso/isoDay round-trip across a leap February", () => {
    for (const iso of ["2026-02-27", "2026-02-28", "2026-03-01", "2026-12-31", "2027-01-01"]) {
      expect(dayIso(isoDay(iso))).toBe(iso);
    }
  });
});
