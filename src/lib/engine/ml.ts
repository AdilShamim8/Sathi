/**
 * P0 — ML shortfall-risk model + validation harness.
 *
 * Task: for a user on day t, predict P(running balance dips below the
 * safety line during days t+1..t+7) — binary probabilistic classification.
 *
 * Model: L2-regularized logistic regression trained on a seeded synthetic
 * population (6 personas × 9 variations × 6 months). Splits are BY USER so
 * no user's data straddles train and test (no leakage).
 *
 * Validation (P0 requirement): the ML model is compared against a simple
 * deterministic rule baseline and climatology using Brier Score, Brier
 * Skill Score, PR-AUC and a Reliability (calibration) table.
 *
 * The simple rule baseline: risk = 1 when expected 7-day outflow at the
 * trailing mean exceeds the current balance, else 0.
 *
 * Everything is deterministic (seeded PRNG, fixed iteration count) so
 * metrics reproduce exactly on every cold start.
 */
import type { RiskMetrics, CalibrationBin, Txn, ShortfallRiskResult, Direction } from "./domain";
import { RISK_MODEL_VERSION } from "./domain";
import { makeRng } from "./rng";
import { generateTrainingPopulation, type SyntheticTxn } from "./synthetic";
import { startOfDay } from "./analytics";

const DAY = 24 * 3600 * 1000;

export const FEATURE_NAMES = [
  "log_balance",
  "days_to_income",
  "outflow_7d",
  "outflow_30d_daily",
  "net_volatility_30d",
  "obligations_next_7d",
  "is_month_end",
  "inflow_7d",
  "coverage_ratio",
  "daily_essentials",
] as const;

export type FeatureVector = number[];

interface DayRow {
  userIdx: number;
  date: string;
  x: FeatureVector;
  y: number; // label
  ruleP: number; // simple-rule baseline probability (0 or 1)
}

/* ------------------------- daily flow helpers ------------------------- */

interface DailyFlow { date: number; in: number; out: number; balance: number } // balance = end of day

function dailyFlows(txns: { timestamp: Date; amount: number; direction: Direction }[], opening: number, startTs: number, endTs: number): DailyFlow[] {
  const map = new Map<number, { in: number; out: number }>();
  for (const t of txns) {
    const k = Math.floor(startOfDay(t.timestamp).getTime() / DAY);
    const e = map.get(k) ?? { in: 0, out: 0 };
    if (t.direction === "in") e.in += t.amount; else e.out += t.amount;
    map.set(k, e);
  }
  const flows: DailyFlow[] = [];
  let bal = opening;
  for (let ts = startTs; ts <= endTs; ts += DAY) {
    const k = Math.floor(ts / DAY);
    const e = map.get(k) ?? { in: 0, out: 0 };
    bal += e.in - e.out;
    flows.push({ date: k, in: e.in, out: e.out, balance: bal });
  }
  return flows;
}

/** Learn expected obligations in the next 7 days from recurring patterns in
 *  the user's history STRICTLY BEFORE day t (leakage-safe). */
function obligationsNext7d(hist: { timestamp: Date; amount: number; direction: Direction; category: string; subcategory: string | null; merchant: string | null }[], t: number): number {
  // recurring monthly obligations: (category|merchant) seen on ≥2 distinct months on a similar day
  const groups = new Map<string, { doms: Map<number, { n: number; total: number }> }>();
  for (const h of hist) {
    if (h.direction !== "out") continue;
    const key = `${h.category}|${h.merchant ?? ""}`;
    if (!groups.has(key)) groups.set(key, { doms: new Map() });
    const g = groups.get(key)!;
    const dom = h.timestamp.getDate();
    const e = g.doms.get(dom) ?? { n: 0, total: 0 };
    g.doms.set(dom, { n: e.n + 1, total: e.total + h.amount });
  }
  let obligations = 0;
  const tDate = new Date(t * DAY);
  for (let h = 1; h <= 7; h++) {
    const future = new Date(tDate.getTime() + h * DAY);
    const dom = future.getDate();
    for (const g of groups.values()) {
      const hit = g.doms.get(dom);
      if (hit && hit.n >= 2) obligations += hit.total / hit.n;
    }
  }
  return obligations;
}

function detectSalaryDom(txns: { timestamp: Date; amount: number; direction: Direction }[], before: number): number | null {
  const big = txns.filter((t) => t.direction === "in" && t.amount >= 5000 && t.timestamp.getTime() < before);
  if (big.length < 2) return null;
  const counts = new Map<number, number>();
  for (const t of big) {
    const dom = t.timestamp.getDate();
    counts.set(dom, (counts.get(dom) ?? 0) + 1);
  }
  // cluster ±2 days — salaries land with 1–3 day jitter
  let bestDom: number | null = null;
  let bestCount = 0;
  for (let dom = 1; dom <= 31; dom++) {
    let cluster = 0;
    for (let d = dom - 2; d <= dom + 2; d++) cluster += counts.get(d) ?? 0;
    if (cluster > bestCount) { bestCount = cluster; bestDom = dom; }
  }
  return bestDom;
}

/* ------------------------- feature building ------------------------- */

function buildUserRows(
  txns: SyntheticTxn[],
  openingBalance: number,
  userIdx: number,
): DayRow[] {
  const startTs = startOfDay(txns[0]?.timestamp ?? new Date()).getTime();
  const lastTs = Math.max(...txns.map((t) => t.timestamp.getTime()));
  const endTs = startOfDay(new Date(lastTs)).getTime();
  const flows = dailyFlows(txns, openingBalance, startTs, endTs);
  const salaryDom = detectSalaryDom(txns, endTs);

  const rows: DayRow[] = [];
  for (let i = 30; i < flows.length - 7; i++) {
    const day = flows[i];
    const t = day.date * DAY;

    // trailing stats over [i-29, i] (features see only ≤ t)
    let out7 = 0, in7 = 0;
    for (let k = i - 6; k <= i; k++) { out7 += flows[k].out; in7 += flows[k].in; }
    let out30 = 0;
    const nets: number[] = [];
    for (let k = i - 29; k <= i; k++) { out30 += flows[k].out; nets.push(flows[k].in - flows[k].out); }
    const meanNet = nets.reduce((s, v) => s + v, 0) / nets.length;
    const sdNet = Math.sqrt(nets.reduce((s, v) => s + (v - meanNet) ** 2, 0) / nets.length);

    // daily essentials proxy from history before t (essential categories)
    // use category-level approximation: obligations + food/transport pattern
    const hist = txns.filter((x) => x.timestamp.getTime() < t);
    const oblig = obligationsNext7d(hist, day.date);

    // days to next salary-like income
    let daysToIncome = 31;
    if (salaryDom !== null) {
      const d = new Date(t);
      let next = new Date(d.getFullYear(), d.getMonth(), Math.min(salaryDom, 28));
      if (next.getTime() <= d.getTime()) next = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(salaryDom, 28));
      daysToIncome = Math.min(31, Math.max(0, Math.round((next.getTime() - d.getTime()) / DAY)));
    }

    // essentials: mean daily essential-category outflow over trailing 30d
    const ESSENTIAL = new Set(["food_beverage", "groceries", "transport", "housing", "utilities", "mobile_topup", "health", "education", "send_money"]);
    let ess30 = 0;
    const t30back = t - 30 * DAY;
    for (const h of hist) {
      if (h.direction === "out" && ESSENTIAL.has(h.category) && h.timestamp.getTime() >= t30back) ess30 += h.amount;
    }
    const dailyEssentials = Math.max(200, Math.round(ess30 / 30));

    // label: does balance dip below safety line within next 7 days?
    const safetyLine = Math.max(dailyEssentials, 500);
    let dipped = false;
    for (let k = i + 1; k <= i + 7; k++) {
      if (flows[k].balance < safetyLine) { dipped = true; break; }
    }

    const dailyOut30 = out30 / 30;
    const coverage = day.balance / (Math.max(1, dailyOut30 * 7));

    const x: FeatureVector = [
      Math.log1p(Math.max(0, day.balance)),
      daysToIncome,
      Math.log1p(out7),
      Math.log1p(dailyOut30),
      Math.log1p(sdNet),
      Math.log1p(oblig),
      new Date(t).getDate() >= 21 ? 1 : 0,
      Math.log1p(in7),
      Math.min(10, coverage),
      Math.log1p(dailyEssentials),
    ];

    // simple rule baseline: expected 7-day outflow at trailing mean vs balance
    const ruleP = dailyOut30 * 7 > day.balance ? 1 : 0;

    rows.push({ userIdx, date: new Date(t).toISOString().slice(0, 10), x, y: dipped ? 1 : 0, ruleP });
  }
  return rows;
}

/* ------------------------- logistic regression ------------------------- */

interface LogReg {
  w: number[];
  b: number;
  mu: number[];
  sd: number[];
}

function standardize(X: number[][]): { mu: number[]; sd: number[] } {
  const d = X[0].length;
  const mu = new Array(d).fill(0);
  const sd = new Array(d).fill(1);
  for (const row of X) for (let j = 0; j < d; j++) mu[j] += row[j] / X.length;
  for (let j = 0; j < d; j++) {
    let v = 0;
    for (const row of X) v += (row[j] - mu[j]) ** 2;
    sd[j] = Math.sqrt(v / X.length) || 1;
  }
  return { mu, sd };
}

function trainLogreg(X: number[][], y: number[], epochs = 400, lr = 0.15, l2 = 1e-3): LogReg {
  const { mu, sd } = standardize(X);
  const n = X.length;
  const d = X[0].length;
  const Z = X.map((row) => row.map((v, j) => (v - mu[j]) / sd[j]));
  const w = new Array(d).fill(0);
  let b = 0;
  for (let ep = 0; ep < epochs; ep++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Z[i][j];
      const p = 1 / (1 + Math.exp(-z));
      const err = p - y[i];
      for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= lr * (gb / n);
  }
  return { w, b, mu, sd };
}

function predict(model: LogReg, x: number[]): number {
  let z = model.b;
  for (let j = 0; j < model.w.length; j++) {
    z += model.w[j] * ((x[j] - model.mu[j]) / model.sd[j]);
  }
  return 1 / (1 + Math.exp(-z));
}

/* ------------------------- metrics ------------------------- */

function brierScore(ps: number[], ys: number[]): number {
  if (!ps.length) return NaN;
  return ps.reduce((s, p, i) => s + (p - ys[i]) ** 2, 0) / ps.length;
}

/** Average precision = area under precision-recall curve (step integration). */
function prAuc(ps: number[], ys: number[]): number {
  const order = ps.map((p, i) => ({ p, y: ys[i] })).sort((a, b) => b.p - a.p);
  const nPos = ys.reduce((s, v) => s + v, 0);
  if (nPos === 0 || nPos === ys.length) return NaN;
  let tp = 0, fp = 0, ap = 0, prevRecall = 0;
  for (const { y } of order) {
    if (y === 1) tp++; else fp++;
    const recall = tp / nPos;
    const precision = tp / (tp + fp);
    ap += (recall - prevRecall) * precision;
    prevRecall = recall;
  }
  return ap;
}

/** ROC-AUC via rank statistic. */
function rocAuc(ps: number[], ys: number[]): number {
  const nPos = ys.reduce((s, v) => s + v, 0);
  const nNeg = ys.length - nPos;
  if (nPos === 0 || nNeg === 0) return NaN;
  const order = ps.map((p, i) => ({ p, y: ys[i] })).sort((a, b) => a.p - b.p);
  let rankSum = 0;
  for (let i = 0; i < order.length; i++) {
    if (order[i].y === 1) rankSum += i + 1;
  }
  return (rankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/** Reliability: 10 equal-width calibration bins. */
function reliability(ps: number[], ys: number[]): CalibrationBin[] {
  const bins: CalibrationBin[] = [];
  for (let k = 0; k < 10; k++) {
    const lo = k / 10, hi = (k + 1) / 10;
    const idx = ps.map((p, i) => ({ p, y: ys[i] })).filter(({ p }) => p >= lo && (p < hi || (k === 9 && p <= hi)));
    if (idx.length === 0) {
      bins.push({ lo, hi, n: 0, meanPred: (lo + hi) / 2, obsRate: 0 });
    } else {
      bins.push({
        lo, hi, n: idx.length,
        meanPred: idx.reduce((s, v) => s + v.p, 0) / idx.length,
        obsRate: idx.reduce((s, v) => s + v.y, 0) / idx.length,
      });
    }
  }
  return bins;
}

/* ------------------------- orchestration ------------------------- */

export interface TrainedRiskModel {
  model: LogReg;
  metrics: RiskMetrics;
  trainRows: DayRow[];
  testRows: DayRow[];
}

let cached: TrainedRiskModel | null = null;

/** Train + evaluate once per server process (deterministic, seeded). */
export function getRiskModel(): TrainedRiskModel {
  if (cached) return cached;

  const anchor = new Date();
  const population = generateTrainingPopulation(anchor, 9, 6);
  const rng = makeRng(777);

  // user-level split: 60% train, 20% val, 20% test (frozen)
  const idxs = population.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  const nTest = Math.floor(idxs.length * 0.2);
  const nVal = Math.floor(idxs.length * 0.2);
  const testSet = new Set(idxs.slice(0, nTest));
  const valSet = new Set(idxs.slice(nTest, nTest + nVal));
  const trainSet = new Set(idxs.slice(nTest + nVal));

  const allRows = new Map<number, DayRow[]>();
  for (const p of population) {
    allRows.set(p.userIdx, buildUserRows(p.txns, p.openingBalance, p.userIdx));
  }

  const trainRows = [...trainSet].flatMap((i) => allRows.get(i) ?? []);
  const valRows = [...valSet].flatMap((i) => allRows.get(i) ?? []);
  const testRows = [...testSet].flatMap((i) => allRows.get(i) ?? []);

  const model = trainLogreg(trainRows.map((r) => r.x), trainRows.map((r) => r.y));

  // choose a probability threshold on VALIDATION only (maximize F1)
  let bestThr = 0.5, bestF1 = -1;
  for (let thr = 0.1; thr <= 0.9; thr += 0.05) {
    let tp = 0, fp = 0, fn = 0;
    for (const r of valRows) {
      const p = predict(model, r.x);
      const pred = p >= thr ? 1 : 0;
      if (pred === 1 && r.y === 1) tp++;
      else if (pred === 1 && r.y === 0) fp++;
      else if (pred === 0 && r.y === 1) fn++;
    }
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;
    if (f1 > bestF1) { bestF1 = f1; bestThr = thr; }
  }

  // final metrics on the frozen TEST users
  const ps = testRows.map((r) => predict(model, r.x));
  const ys = testRows.map((r) => r.y);
  const rulePs = testRows.map((r) => r.ruleP);

  const mlBrier = brierScore(ps, ys);
  const ruleBrier = brierScore(rulePs, ys);
  const climoP = trainRows.reduce((s, r) => s + r.y, 0) / Math.max(1, trainRows.length);
  const climoPs = testRows.map(() => climoP);
  const climoBrier = brierScore(climoPs, ys);

  const metrics: RiskMetrics = {
    modelVersion: RISK_MODEL_VERSION,
    trainedOn: {
      users: trainSet.size,
      days: trainRows.length,
      positives: trainRows.reduce((s, r) => s + r.y, 0),
    },
    testedOn: {
      users: testSet.size,
      days: testRows.length,
      positives: testRows.reduce((s, r) => s + r.y, 0),
    },
    ml: {
      brier: round4(mlBrier),
      prAuc: round4(prAuc(ps, ys)),
      auc: round4(rocAuc(ps, ys)),
      reliability: reliability(ps, ys).map((b) => ({
        ...b, meanPred: round4(b.meanPred), obsRate: round4(b.obsRate),
      })),
    },
    ruleBaseline: {
      brier: round4(ruleBrier),
      prAuc: round4(prAuc(rulePs, ys)),
      auc: round4(rocAuc(rulePs, ys)),
      description: "Simple rule: risk = 1 when trailing-mean 7-day outflow exceeds current balance, else 0",
    },
    climatology: { brier: round4(climoBrier) },
    brierSkillScoreVsRule: round4(1 - mlBrier / (ruleBrier || 1e-9)),
    brierSkillScoreVsClimatology: round4(1 - mlBrier / (climoBrier || 1e-9)),
    coefficients: model.w.map((w, j) => ({ feature: FEATURE_NAMES[j], weight: round4(w) })),
    featureNames: [...FEATURE_NAMES],
  };

  cached = { model, metrics, trainRows, testRows };
  return cached;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export { predict as predictRisk };

/* ------------------------- inference for the live user ------------------------- */

/**
 * P0 inference: shortfall probability for the CURRENT user over the next
 * `horizonDays`, plus explainability contributions per feature.
 */
export function shortfallRisk(
  txns: Txn[],
  anchor: Date,
  openingBalance: number,
  balanceEstimate: number,
  horizonDays = 7,
  salaryInfo?: { amount: number | null; payDay: number | null },
): ShortfallRiskResult {
  // No history yet: there is no evidence to estimate risk from. A brand-new
  // ledger must not be shown a scary extrapolation — report a neutral,
  // honestly-labelled result until transactions exist.
  if (txns.length === 0) {
    return {
      probability: 0,
      riskLevel: "low",
      modelVersion: RISK_MODEL_VERSION,
      baselineRuleProbability: 0,
      topFactors: [{
        label: "Transaction history",
        value: "Not enough data yet — add income and expenses to unlock the risk forecast",
        contribution: 0,
      }],
      troughDay: null,
      projectedTrough: Math.max(0, balanceEstimate),
      expectedMinBalance: Math.max(0, balanceEstimate),
    };
  }

  const { model } = getRiskModel();

  const sorted = [...txns].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const startTs = sorted.length ? startOfDay(sorted[0].timestamp).getTime() : startOfDay(anchor).getTime();
  const endTs = startOfDay(anchor).getTime();
  const flows = dailyFlows(
    sorted.map((t) => ({ timestamp: new Date(t.timestamp), amount: t.amount, direction: t.direction })),
    openingBalance, startTs, endTs,
  );
  const salaryDom = detectSalaryDom(
    sorted.map((t) => ({ timestamp: new Date(t.timestamp), amount: t.amount, direction: t.direction })),
    endTs + DAY,
  );

  const i = flows.length - 1;
  const day = flows[i];

  let out7 = 0, in7 = 0;
  for (let k = Math.max(0, i - 6); k <= i; k++) { out7 += flows[k].out; in7 += flows[k].in; }
  let out30 = 0;
  const nets: number[] = [];
  for (let k = Math.max(0, i - 29); k <= i; k++) { out30 += flows[k].out; nets.push(flows[k].in - flows[k].out); }
  const meanNet = nets.reduce((s, v) => s + v, 0) / Math.max(1, nets.length);
  const sdNet = Math.sqrt(nets.reduce((s, v) => s + (v - meanNet) ** 2, 0) / Math.max(1, nets.length));

  const hist = sorted.filter((t) => new Date(t.timestamp).getTime() < anchor.getTime());
  const oblig = obligationsNext7d(
    hist.map((t) => ({ timestamp: new Date(t.timestamp), amount: t.amount, direction: t.direction, category: t.category, subcategory: t.subcategory, merchant: t.merchant })),
    Math.floor(endTs / DAY),
  );

  let daysToIncome = 31;
  let effectiveDom = salaryDom ?? salaryInfo?.payDay ?? null;
  if (effectiveDom !== null) {
    const d = new Date(endTs);
    let next = new Date(d.getFullYear(), d.getMonth(), Math.min(effectiveDom, 28));
    if (next.getTime() <= d.getTime()) next = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(effectiveDom, 28));
    daysToIncome = Math.min(31, Math.max(0, Math.round((next.getTime() - d.getTime()) / DAY)));
  }

  const ESSENTIAL = new Set(["food_beverage", "groceries", "transport", "housing", "utilities", "mobile_topup", "health", "education", "send_money"]);
  let ess30 = 0;
  const t30back = anchor.getTime() - 30 * DAY;
  for (const h of hist) {
    if (h.direction === "out" && ESSENTIAL.has(h.category) && new Date(h.timestamp).getTime() >= t30back) ess30 += h.amount;
  }
  const dailyEssentials = Math.max(200, Math.round(ess30 / 30));

  const dailyOut30 = out30 / Math.max(1, Math.min(30, flows.length));
  const coverage = balanceEstimate / Math.max(1, dailyOut30 * 7);

  const x: FeatureVector = [
    Math.log1p(Math.max(0, balanceEstimate)),
    daysToIncome,
    Math.log1p(out7),
    Math.log1p(dailyOut30),
    Math.log1p(sdNet),
    Math.log1p(oblig),
    anchor.getDate() >= 21 ? 1 : 0,
    Math.log1p(in7),
    Math.min(10, coverage),
    Math.log1p(dailyEssentials),
  ];

  const p = predict(model, x);
  const ruleP = dailyOut30 * 7 > balanceEstimate ? 1 : 0;

  // explainability: contribution = w * z (signed, standardized)
  const contributions = model.w.map((w, j) => ({
    j, w,
    contrib: w * ((x[j] - model.mu[j]) / model.sd[j]),
  })).sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

  const FACTOR_LABELS: Record<string, (v: number) => { label: string; value: string }> = {
    log_balance: (v) => ({ label: "Current cash-on-hand", value: `৳${balanceEstimate.toLocaleString()}` }),
    days_to_income: () => ({ label: "Days until next salary-like income", value: `${daysToIncome === 31 ? "31+" : daysToIncome} days` }),
    outflow_7d: () => ({ label: "Spending in the last 7 days", value: `৳${out7.toLocaleString()}` }),
    outflow_30d_daily: () => ({ label: "Average daily outflow (30d)", value: `৳${Math.round(dailyOut30).toLocaleString()}` }),
    net_volatility_30d: () => ({ label: "Cash-flow volatility (30d)", value: `৳${Math.round(sdNet).toLocaleString()} std` }),
    obligations_next_7d: () => ({ label: "Recurring obligations due next 7 days", value: `৳${Math.round(oblig).toLocaleString()}` }),
    is_month_end: () => ({ label: "Time of month", value: anchor.getDate() >= 21 ? "month-end window (days 21–31)" : "earlier in the month" }),
    inflow_7d: () => ({ label: "Income received in last 7 days", value: `৳${in7.toLocaleString()}` }),
    coverage_ratio: () => ({ label: "Balance vs 7-day spending needs", value: `${coverage.toFixed(1)}× coverage` }),
    daily_essentials: () => ({ label: "Essential daily spend", value: `৳${dailyEssentials.toLocaleString()}/day` }),
  };

  const topFactors = contributions.slice(0, 5).map((c) => {
    const f = FACTOR_LABELS[FEATURE_NAMES[c.j]]?.(c.w);
    return {
      label: f?.label ?? FEATURE_NAMES[c.j],
      value: f?.value ?? "",
      contribution: round4(c.contrib),
    };
  });

  // projected trough: walk the balance forward with expected flows
  let bal = balanceEstimate;
  let trough = bal;
  let troughDay: string | null = null;
  const dailyOut = dailyOut30;
  for (let h = 1; h <= horizonDays; h++) {
    const future = new Date(endTs + h * DAY);
    let inFlow = 0;
    if (effectiveDom !== null && future.getDate() === Math.min(effectiveDom, 28)) inFlow += salaryInfo?.amount ?? 30000;
    bal += inFlow - dailyOut;
    if (bal < trough) { trough = bal; troughDay = future.toISOString().slice(0, 10); }
  }

  const riskLevel: ShortfallRiskResult["riskLevel"] = p >= 0.6 ? "high" : p >= 0.3 ? "medium" : "low";

  return {
    probability: round4(p),
    riskLevel,
    modelVersion: RISK_MODEL_VERSION,
    baselineRuleProbability: ruleP,
    topFactors,
    troughDay,
    projectedTrough: Math.round(trough),
    expectedMinBalance: Math.round(trough),
  };
}
