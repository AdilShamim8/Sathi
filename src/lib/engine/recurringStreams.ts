/**
 * Leakage-safe income timing and recurring-stream detection — port of the
 * additions the ML handoff made to the reference core/recurring.py.
 *
 * Everything here reads only transactions dated strictly BEFORE the forecast
 * origin, so later data can never change a feature (the salary-day leakage
 * fix, e091b3a). Pure: no config, no persona labels, no clocks.
 */

import { domOfDay, type Day } from "./timeutils";

/** Income rhythm seen strictly before an origin date. */
export interface IncomeTiming {
  /** Days since the last major inflow (capped). */
  daysSinceIncome: number;
  /** Expected days until the next one (0 = due/overdue). */
  daysToNextIncome: number;
  /** Median gap between major inflow days (capped). */
  periodDays: number;
  /** Major inflow days in the lookback window. */
  nMajor: number;
}

/**
 * Detect the income rhythm from inflows dated strictly before `origin`.
 *
 * A "major" inflow day is one whose total is at least `majorFrac` of the
 * median of the three largest inflow days in the lookback window. This finds
 * a monthly salary, an irregular remittance and daily earnings alike, without
 * reading any persona configuration. Inflows on or after `origin` are ignored.
 */
export function incomeTiming(
  inflowDays: Day[],
  inflowAmounts: number[],
  origin: Day,
  lookbackDays = 120,
  majorFrac = 0.5,
  capDays = 60,
): IncomeTiming {
  const lo = origin - lookbackDays;
  const byDay = new Map<Day, number>();
  for (let i = 0; i < inflowDays.length; i++) {
    const d = inflowDays[i]!;
    if (d >= lo && d < origin) {
      byDay.set(d, (byDay.get(d) ?? 0) + Math.trunc(inflowAmounts[i]!));
    }
  }
  if (byDay.size === 0) {
    return { daysSinceIncome: capDays, daysToNextIncome: capDays, periodDays: capDays, nMajor: 0 };
  }
  const top = [...byDay.values()].sort((a, b) => b - a).slice(0, 3);
  const threshold = majorFrac * top[Math.floor(top.length / 2)]!;
  const major = [...byDay.keys()].filter((d) => (byDay.get(d) ?? 0) >= threshold).sort((a, b) => a - b);
  const since = Math.min(origin - major[major.length - 1]!, capDays);
  if (major.length < 2) {
    return { daysSinceIncome: since, daysToNextIncome: capDays, periodDays: capDays, nMajor: major.length };
  }
  const gaps: number[] = [];
  for (let i = 1; i < major.length; i++) gaps.push(major[i]! - major[i - 1]!);
  gaps.sort((a, b) => a - b);
  const period = Math.min(gaps[Math.floor(gaps.length / 2)]!, capDays);
  return { daysSinceIncome: since, daysToNextIncome: Math.max(period - since, 0), periodDays: period, nMajor: major.length };
}

/** A recurring stream detected from history before an origin. */
export interface Stream {
  key: string;
  /** +1 inflow, -1 outflow. */
  direction: number;
  /** Median gap between occurrences (days). */
  periodDays: number;
  lastDay: Day;
  /** Observed gap - period per gap (date jitter to sample from). */
  gapResiduals: number[];
  /** Observed amounts (to sample from). */
  amounts: number[];
  /** Typical day of month (monthly streams on a fixed day), else null. */
  anchorDom: number | null;
  /** Observed day - anchor (date jitter for anchored streams). */
  domResiduals: number[];
}

/** A raw wallet event for stream detection: (day, key, direction, amount). */
export interface StreamEvent {
  day: Day;
  key: string;
  direction: number;
  amount: number;
}

const PERIOD_WINDOWS: [number, number][] = [
  [5, 9],
  [12, 16],
  [25, 45],
];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

function mad(xs: number[]): number {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * Recurring streams from events dated strictly before `origin`. Pure.
 *
 * A key (e.g. type + counterparty) is a stream when it occurred at least
 * `minOccurrences` times with a weekly, fortnightly or (roughly) monthly
 * median gap, regular gaps (MAD <= 20% of the period) and stable amounts
 * (MAD <= 20% of the median). Streams silent for more than two periods are
 * treated as ended. Occurrences below half the key's median amount (side
 * payments such as a bonus) are ignored.
 */
export function detectStreams(
  events: StreamEvent[],
  origin: Day,
  minOccurrences = 3,
  maxGapMadFrac = 0.2,
  maxAmountMadFrac = 0.2,
): Stream[] {
  const byKey = new Map<string, { day: Day; direction: number; amount: number }[]>();
  for (const e of events) {
    if (e.day < origin) {
      const arr = byKey.get(e.key) ?? [];
      arr.push({ day: e.day, direction: e.direction, amount: Math.trunc(e.amount) });
      byKey.set(e.key, arr);
    }
  }
  const out: Stream[] = [];
  for (const key of [...byKey.keys()].sort()) {
    let items = byKey.get(key)!;
    if (items.length < minOccurrences) continue;
    items = items
      .slice()
      .sort((a, b) => a.day - b.day)
      // Ignore side payments on the same key (e.g. an Eid bonus from the
      // employer): occurrences below half the median amount.
      .filter((it) => it.amount >= 0.5 * median(items.map((x) => x.amount)));
    if (items.length < minOccurrences) continue;
    const days = items.map((it) => it.day);
    const gaps: number[] = [];
    for (let i = 1; i < days.length; i++) {
      const g = days[i]! - days[i - 1]!;
      if (g > 0) gaps.push(g);
    }
    if (gaps.length < minOccurrences - 1) continue;
    const period = median(gaps);
    if (!PERIOD_WINDOWS.some(([lo, hi]) => period >= lo && period <= hi)) continue;
    if (mad(gaps) > maxGapMadFrac * period) continue;
    const amounts = items.map((it) => it.amount);
    const med = median(amounts);
    if (med <= 0 || mad(amounts) > maxAmountMadFrac * med) continue;
    if (origin - days[days.length - 1]! > 2 * period) continue;
    let anchorDom: number | null = null;
    let domRes: number[] = [];
    if (period >= 25 && period <= 35) {
      const doms = items.map((it) => domOfDay(it.day));
      const anchor = median(doms);
      if (mad(doms) <= 3) {
        anchorDom = anchor;
        domRes = doms.map((x) => x - anchor);
      }
    }
    out.push({
      key,
      direction: items[items.length - 1]!.direction,
      periodDays: period,
      lastDay: days[days.length - 1]!,
      gapResiduals: gaps.map((g) => g - period),
      amounts,
      anchorDom,
      domResiduals: domRes,
    });
  }
  return out;
}
