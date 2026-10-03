/**
 * Per-user daily panel and leakage-safe features for the irregular-flow
 * model — port of the reference ml/panel.py + ml/features.py (ML handoff).
 *
 * Decomposition (docs/ML_PLAN.md §4.2):
 *
 *     daily wallet net = scheduled streams   (recurringStreams.detectStreams)
 *                     + irregular net flow  (LightGBM quantile model)
 *
 * "Irregular" = every transaction that is not part of a detected recurring
 * stream: everyday spending, cash-outs, daily earnings, shocks, one-off
 * transfers. Its daily net is divided by a per-user scale (mean daily
 * irregular gross flow over the 90 days before the origin) so one global
 * model serves users of every income level.
 *
 * An origin is the END of a day d0: everything dated <= d0 is known
 * (including that day's closing balance); forecasts cover d0+1 .. d0+H.
 * Every feature is computed from days <= d0 only. No persona label, persona
 * configuration, ground truth or user id is ever used (the salary-day
 * leakage fix). All money is integer paisa.
 */

import { cashTimeConstantDays, estimateCashV2 } from "./cashOnHand";
import { detectStreams, incomeTiming, type IncomeTiming, type Stream, type StreamEvent } from "./recurringStreams";
import { domOfDay, weekdayOfDay, type Day } from "./timeutils";

export const INFLOW_TYPES = ["salary_in", "remittance_in", "cash_in"] as const;

export const TAUS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

export const MIN_HISTORY_DAYS = 30;
export const MIN_TRAIN_HISTORY_DAYS = 90;

/** Model input columns, in the exact order the boosters were trained on. */
export const FEATURES = [
  // origin state (scale-free)
  "log_scale", "lifetime_days",
  "irr_net_7", "irr_net_30", "irr_net_90", "irr_net_std_30",
  "irr_out_7", "irr_out_30", "irr_in_7", "irr_in_30", "no_income_share_30",
  "irr_out_last1", "irr_out_last2", "irr_out_last3",
  "cashout_7", "days_since_cashout", "cash_est", "cash_tc_days",
  "balance_scaled", "balance_days_cover", "inflow_cv_90",
  "income_period_days",
  // target day
  "k", "dow", "dom", "is_month_end", "is_festival",
  "days_since_income", "days_to_income", "dom_irr_profile",
] as const;

export type FeatureName = (typeof FEATURES)[number];

/** One wallet transaction in the reference's shape (paisa, Dhaka day). */
export interface PanelTxn {
  day: Day;
  /** Reference vocabulary: salary_in | remittance_in | cash_in | cash_out | p2m_out | p2p_out | topup | bill_pay … */
  type: string;
  amountPaisa: number;
  feePaisa: number;
  counterpartyId: string;
  /** Post-transaction wallet balance if known (null → forward-fill/0). */
  balanceAfterPaisa: number | null;
}

/**
 * Stream key. Cash-outs share agents across purposes, so their key also
 * carries a ~25%-wide amount bucket (e.g. rent paid in cash vs pocket money).
 */
export function eventKey(type: string, counterpartyId: string, amount: number): string {
  if (type === "cash_out") {
    const bucket = Math.round(Math.log(Math.max(amount, 1)) / Math.log(1.25));
    return `${type}|${counterpartyId}|${bucket}`;
  }
  return `${type}|${counterpartyId}`;
}

/** Daily arrays for one user (index 0 = first day with a transaction). */
export interface UserPanel {
  userId: string;
  startDay: Day;
  nDays: number;
  irrIn: Float64Array;
  irrOut: Float64Array;
  schedNet: Float64Array;
  outTotal: Float64Array;
  /** Irregular (non-stream) cash-outs, paisa. */
  cashout: Float64Array;
  /** End-of-day wallet balance (paisa); NaN before the first observed one. */
  eodBalance: Float64Array;
  events: StreamEvent[];
  inflowDays: Day[];
  inflowAmounts: number[];
  cashoutEvents: { day: Day; key: string; amount: number }[];
}

export function buildPanel(userId: string, txns: PanelTxn[], end: Day): UserPanel {
  const t = [...txns].sort((a, b) => a.day - b.day || a.type.localeCompare(b.type));
  if (t.length === 0) {
    return {
      userId, startDay: end, nDays: 1,
      irrIn: new Float64Array(1), irrOut: new Float64Array(1), schedNet: new Float64Array(1),
      outTotal: new Float64Array(1), cashout: new Float64Array(1), eodBalance: new Float64Array(1).fill(NaN),
      events: [], inflowDays: [], inflowAmounts: [], cashoutEvents: [],
    };
  }
  const start = t[0]!.day;
  const n = end - start + 1;

  const is_in = (type: string) => (INFLOW_TYPES as readonly string[]).includes(type);
  const events: StreamEvent[] = t.map((x) => {
    const signed = is_in(x.type) ? x.amountPaisa : -(x.amountPaisa + x.feePaisa);
    return {
      day: x.day,
      key: eventKey(x.type, x.counterpartyId, x.amountPaisa),
      direction: is_in(x.type) ? 1 : -1,
      amount: Math.abs(signed),
    };
  });

  // Scheduled flag: the transaction's key is a stream detected from data
  // before the start of its month (leakage-safe, recomputed monthly).
  const monthStreams = new Map<string, Set<string>>();
  const monthOf = (day: Day) => {
    const d = new Date(day * 86400000);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  };
  const sched = new Array<boolean>(t.length).fill(false);
  for (let j = 0; j < t.length; j++) {
    const mk = monthOf(t[j]!.day);
    if (!monthStreams.has(mk)) {
      const firstOfMonthDay = (() => {
        const d = new Date(t[j]!.day * 86400000);
        return Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 86400000);
      })();
      monthStreams.set(mk, new Set(detectStreams(events, firstOfMonthDay).map((s) => s.key)));
    }
    sched[j] = monthStreams.get(mk)!.has(events[j]!.key);
  }

  const irrIn = new Float64Array(n);
  const irrOut = new Float64Array(n);
  const schedNet = new Float64Array(n);
  const outTotal = new Float64Array(n);
  const cashout = new Float64Array(n);
  const eod = new Float64Array(n).fill(NaN);
  const inflowDays: Day[] = [];
  const inflowAmounts: number[] = [];
  const cashoutEvents: { day: Day; key: string; amount: number }[] = [];

  for (let j = 0; j < t.length; j++) {
    const x = t[j]!;
    const idx = x.day - start;
    const isIn = is_in(x.type);
    const outAmount = x.amountPaisa + x.feePaisa;
    if (isIn && !sched[j]) irrIn[idx] += x.amountPaisa;
    if (!isIn && !sched[j]) irrOut[idx] += outAmount;
    if (sched[j]) schedNet[idx] += isIn ? x.amountPaisa : -outAmount;
    if (!isIn) outTotal[idx] += outAmount;
    if (x.type === "cash_out" && !sched[j]) cashout[idx] += x.amountPaisa;
    if (x.balanceAfterPaisa !== null) eod[idx] = x.balanceAfterPaisa; // last of day wins (sorted)
    if (isIn) {
      inflowDays.push(x.day);
      inflowAmounts.push(x.amountPaisa);
    }
    if (x.type === "cash_out") {
      cashoutEvents.push({ day: x.day, key: events[j]!.key, amount: x.amountPaisa });
    }
  }
  // forward-fill eod
  let last = NaN;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(eod[i]!)) last = eod[i]!;
    else eod[i] = last;
  }

  return {
    userId, startDay: start, nDays: n,
    irrIn, irrOut, schedNet, outTotal, cashout, eodBalance: eod,
    events, inflowDays, inflowAmounts, cashoutEvents,
  };
}

export function panelIndexOf(p: UserPanel, d: Day): number {
  return d - p.startDay;
}

/** Recurring streams known at the end of day d0. */
export function panelStreamsAt(p: UserPanel, d0: Day): Stream[] {
  return detectStreams(p.events, d0 + 1);
}

/** (days_since, days_to) k days after the timing's reference day (ml/features.py). */
export function advanceTiming(t: IncomeTiming, k: number): [number, number] {
  if (k <= t.daysToNextIncome || t.nMajor < 2 || t.periodDays <= 0) {
    return [t.daysSinceIncome + k, Math.max(t.daysToNextIncome - k, 0)];
  }
  const since = (k - t.daysToNextIncome) % t.periodDays;
  return [since, t.periodDays - since];
}

/** Mean over days (i-w, i] from a zero-prefixed cumsum. */
function wmean(c: Float64Array, i: number, w: number): number {
  const lo = Math.max(i + 1 - w, 0);
  return (c[i + 1]! - c[lo]!) / Math.max(i + 1 - lo, 1);
}

function medianArr(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Feature builder over one panel with prefix sums. */
export class OriginFeatures {
  private cNet: Float64Array;
  private cNet2: Float64Array;
  private cIn: Float64Array;
  private cOut: Float64Array;
  private cGross: Float64Array;
  private cNoInc: Float64Array;
  private cCo: Float64Array;

  constructor(
    public readonly p: UserPanel,
    public readonly festivalDays: Set<string>,
  ) {
    const n = p.nDays;
    const pre = () => new Float64Array(n + 1);
    this.cNet = pre();
    this.cNet2 = pre();
    this.cIn = pre();
    this.cOut = pre();
    this.cGross = pre();
    this.cNoInc = pre();
    this.cCo = pre();
    for (let i = 0; i < n; i++) {
      const net = p.irrIn[i]! - p.irrOut[i]!;
      this.cNet[i + 1] = this.cNet[i]! + net;
      this.cNet2[i + 1] = this.cNet2[i]! + net * net;
      this.cIn[i + 1] = this.cIn[i]! + p.irrIn[i]!;
      this.cOut[i + 1] = this.cOut[i]! + p.irrOut[i]!;
      this.cGross[i + 1] = this.cGross[i]! + p.irrIn[i]! + p.irrOut[i]!;
      this.cNoInc[i + 1] = this.cNoInc[i]! + (p.irrIn[i]! === 0 ? 1 : 0);
      this.cCo[i + 1] = this.cCo[i]! + p.cashout[i]!;
    }
  }

  scale(i: number): number {
    return Math.max(wmean(this.cGross, i, 90), 1000.0);
  }

  /** Personal shortfall floor: floorDays × median active-day outflow (90 d). */
  floor(i: number, floorDays: number): number {
    const w: number[] = [];
    for (let j = Math.max(i - 89, 0); j <= i; j++) {
      if (this.p.outTotal[j]! > 0) w.push(this.p.outTotal[j]!);
    }
    return w.length ? floorDays * medianArr(w) : 0.0;
  }

  /** Cash-on-hand v2 at the end of day i (paisa) and the user's cash time constant. */
  cashEstimate(i: number, streams?: Stream[] | null): [number, number] {
    const d0 = this.p.startDay + i;
    const streamKeys = new Set(
      (streams ?? panelStreamsAt(this.p, d0)).map((s) => s.key),
    );
    const cos = this.p.cashoutEvents.filter((c) => c.day <= d0 && !streamKeys.has(c.key));
    if (cos.length === 0) return [0.0, 7.0];
    const tc = cashTimeConstantDays(cos.map((c) => c.day));
    return [estimateCashV2(cos.map((c) => c.day), cos.map((c) => c.amount), d0, tc), tc];
  }

  originState(i: number, streams?: Stream[] | null): Record<FeatureName, number> & {
    _timing: IncomeTiming;
    _domProfile: Float64Array;
  } {
    const p = this.p;
    const d0 = p.startDay + i;
    const s = this.scale(i);
    const f = {} as Record<FeatureName, number> & { _timing: IncomeTiming; _domProfile: Float64Array };
    f.log_scale = Math.log10(s);
    f.lifetime_days = Math.min(i + 1, 365);
    for (const w of [7, 30, 90]) {
      f[`irr_net_${w}` as FeatureName] = wmean(this.cNet, i, w) / s;
    }
    const m30 = wmean(this.cNet, i, 30);
    f.irr_net_std_30 = Math.sqrt(Math.max(wmean(this.cNet2, i, 30) - m30 * m30, 0.0)) / s;
    for (const w of [7, 30]) {
      f[`irr_out_${w}` as FeatureName] = wmean(this.cOut, i, w) / s;
      f[`irr_in_${w}` as FeatureName] = wmean(this.cIn, i, w) / s;
    }
    f.no_income_share_30 = wmean(this.cNoInc, i, 30);
    for (const lag of [1, 2, 3]) {
      f[`irr_out_last${lag}` as FeatureName] = i + 1 - lag >= 0 ? p.irrOut[i + 1 - lag]! / s : 0.0;
    }
    f.cashout_7 = (wmean(this.cCo, i, 7) * 7) / s;
    let coIdx = -1;
    for (let j = i; j >= 0; j--) {
      if (p.cashout[j]! > 0) {
        coIdx = j;
        break;
      }
    }
    f.days_since_cashout = coIdx >= 0 ? Math.min(i - coIdx, 30) : 30.0;
    const [cashEst, cashTc] = this.cashEstimate(i, streams);
    f.cash_est = cashEst / s;
    f.cash_tc_days = cashTc;
    const bal = p.eodBalance[i]!;
    const balSafe = Number.isNaN(bal) ? 0.0 : bal;
    f.balance_scaled = balSafe / s;
    const w: number[] = [];
    for (let j = Math.max(i - 89, 0); j <= i; j++) {
      if (p.outTotal[j]! > 0) w.push(p.outTotal[j]!);
    }
    const medOut = w.length ? medianArr(w) : 1.0;
    f.balance_days_cover = Math.min(balSafe / Math.max(medOut, 1.0), 60.0);
    const monthlyIn: number[] = [];
    for (let j = 0; j < 3; j++) {
      if (i + 1 - 30 * j > 0) {
        let sum = 0;
        for (let d = Math.max(i - 29 - 30 * j, 0); d <= i - 30 * j; d++) sum += p.irrIn[d]!;
        monthlyIn.push(sum);
      }
    }
    if (monthlyIn.length && monthlyIn.reduce((a, b) => a + b, 0) > 0) {
      const mean = monthlyIn.reduce((a, b) => a + b, 0) / monthlyIn.length;
      const std = Math.sqrt(
        monthlyIn.reduce((a, b) => a + (b - mean) * (b - mean), 0) / monthlyIn.length,
      );
      f.inflow_cv_90 = mean > 0 ? std / mean : 0.0;
    } else {
      f.inflow_cv_90 = 0.0;
    }
    const timing = incomeTiming(p.inflowDays, p.inflowAmounts, d0 + 1);
    f.income_period_days = timing.periodDays;
    f._timing = timing;
    // Day-of-month profile of the scaled irregular net (days <= d0).
    const domSum = new Float64Array(32);
    const domCnt = new Float64Array(32);
    for (let j = 0; j <= i; j++) {
      const dom = domOfDay(p.startDay + j);
      domSum[dom] += p.irrIn[j]! - p.irrOut[j]!;
      domCnt[dom] += 1;
    }
    const prof = new Float64Array(32);
    for (let d = 1; d <= 31; d++) {
      prof[d] = domCnt[d]! > 0 ? domSum[d]! / Math.max(domCnt[d]!, 1) / s : 0.0;
    }
    f._domProfile = prof;
    return f;
  }

  /** Feature rows for forecast days k = 1..horizon after origin d0. */
  targetRows(
    state: ReturnType<OriginFeatures["originState"]>,
    d0: Day,
    ks: number[],
  ): number[][] {
    const rows: number[][] = [];
    for (const k of ks) {
      const d = d0 + Math.trunc(k);
      const [since, toNext] = advanceTiming(state._timing, Math.trunc(k) - 1);
      const row = new Array<number>(FEATURES.length);
      for (let c = 0; c < FEATURES.length; c++) {
        const name = FEATURES[c]!;
        let v: number;
        switch (name) {
          case "k": v = k; break;
          case "dow": v = weekdayOfDay(d); break;
          case "dom": v = domOfDay(d); break;
          case "is_month_end": v = domOfDay(d) >= 25 ? 1 : 0; break;
          case "is_festival": v = this.festivalIso(d) ? 1 : 0; break;
          case "days_since_income": v = since; break;
          case "days_to_income": v = toNext; break;
          case "dom_irr_profile": v = state._domProfile[domOfDay(d)]!; break;
          default: v = (state as Record<string, number>)[name] ?? 0;
        }
        row[c] = v;
      }
      rows.push(row);
    }
    return rows;
  }

  private festivalIso(d: Day): boolean {
    return this.festivalDays.has(new Date(d * 86400000).toISOString().slice(0, 10));
  }
}

/**
 * Festival window from the calendar config: each festival day plus the
 * `lead` days before it (config/calendar.yaml: festival_lead_days).
 */
export function festivalWindow(
  festivalDaysIso: readonly string[],
  leadDays: number,
): Set<string> {
  const out = new Set<string>();
  for (const fd of festivalDaysIso) {
    const base = Math.round(Date.parse(`${fd}T00:00:00Z`) / 86400000);
    for (let j = -leadDays; j <= 0; j++) {
      out.add(new Date((base + j) * 86400000).toISOString().slice(0, 10));
    }
  }
  return out;
}
