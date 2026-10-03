/**
 * Sathi personas — faithful port of the reference repo's config/personas.yaml
 * plus the data_gen behaviour it describes (income streams with day-of-month
 * or interval rules, obligations with jitter, front-loaded daily spend,
 * habitual cash-outs with digital-substitution injection, rare shocks).
 *
 * Every number is an ASSUMPTION, documented in the reference
 * docs/assumptions.md. Money is whole taka in this port. All day rules are
 * Asia/Dhaka. Deterministic: seeded PRNG, no real PII.
 *
 * Personas (reference hero first):
 *   garment_worker (Rina) — hero persona
 *   gig_driver (Tariq) — daily earnings, irregular
 *   remittance_household (Jamila) — lumpy 35-day remittance
 *   shopkeeper (Rafiq) — cash-heavy business, weekly supplier
 *   student (Anik) — low-data case → persona priors
 */

import { makeRng, type Rng } from "./rng";
import type { Direction } from "./domain";

export interface SyntheticTxn {
  timestamp: Date;
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

interface IncomeStream {
  kind: "day_of_month" | "every_days" | "daily_mean";
  type: "salary_in" | "remittance_in" | "cash_in";
  amount: number;
  dayOfMonth?: number;
  dayJitter?: number;
  lateProb?: number;
  lateDays?: number;
  amountJitterFrac?: number;
  intervalDays?: number;
  intervalJitter?: number;
  dailyMean: number;
  dailyStdFrac?: number;
  workdayProb?: number;
  skipProb?: number;
}

interface Obligation {
  kind: string;
  category: string;
  amount: number;
  day?: number;
  jitter?: number;
  everyDays?: number;
}

interface CashoutSpec {
  perMonth: [number, number];
  amount: [number, number];
  sameAgentProb: number;
  digitalFollowProb: number;
}

export interface SathiPersonaSpec {
  id: string;
  name: string; // demo display name
  labelBn: string;
  labelEn: string;
  ageBand: string;
  region: string;
  incomeBand: string;
  historyMonths: [number, number];
  startBalance: number;
  incomeStreams: IncomeStream[];
  obligations: Obligation[];
  dailySpend: {
    mean: number;
    stdFrac: number;
    skipProb: number;
    categories: Record<string, number>;
    frontload: { startDay: number; endDay: number; share: number } | null;
  };
  cashout: CashoutSpec;
  shock: { probPerMonth: number; amount: [number, number] };
}

const AGENTS = ["Agent Rashid", "Agent Nazma", "Agent Korim", "Agent Point"];
const DIGITAL_MERCHANTS = ["Meena Bazar", "Shwapno", "Agora Super Shop", "Local Pharmacy", "DESCO Bill"];

export const SATHI_PERSONAS: Record<string, SathiPersonaSpec> = {
  garment_worker: {
    id: "garment_worker",
    name: "Rina Begum",
    labelBn: "পোশাক শ্রমিক",
    labelEn: "Garment worker",
    ageBand: "25-34",
    region: "dhaka",
    incomeBand: "15k-25k",
    historyMonths: [10, 12],
    startBalance: 3000,
    incomeStreams: [
      { kind: "day_of_month", type: "salary_in", amount: 18000, dayOfMonth: 7, dayJitter: 2, lateProb: 0.1, lateDays: 5, amountJitterFrac: 0.02, dailyMean: 0 },
    ],
    obligations: [
      { kind: "rent", category: "housing", amount: 5000, day: 8, jitter: 1 },
      { kind: "bills", category: "utilities", amount: 1000, day: 10, jitter: 2 },
      { kind: "mobile", category: "mobile_topup", amount: 500, day: 11, jitter: 2 },
      { kind: "family", category: "send_money", amount: 2000, day: 10, jitter: 1 },
    ],
    dailySpend: {
      mean: 80, stdFrac: 0.35, skipProb: 0.1,
      categories: { food_beverage: 0.55, transport: 0.25, shopping: 0.2 },
      frontload: { startDay: 7, endDay: 14, share: 0.65 }, // 65% right after payday
    },
    cashout: { perMonth: [6, 9], amount: [700, 1500], sameAgentProb: 0.8, digitalFollowProb: 0.4 },
    shock: { probPerMonth: 0.15, amount: [1000, 3000] },
  },

  gig_driver: {
    id: "gig_driver",
    name: "Tariq Hasan",
    labelBn: "গিগ চালক",
    labelEn: "Gig driver",
    ageBand: "18-24",
    region: "dhaka",
    incomeBand: "15k-25k",
    historyMonths: [10, 12],
    startBalance: 1500,
    incomeStreams: [
      { kind: "daily_mean", type: "cash_in", amount: 0, dailyMean: 1100, dailyStdFrac: 0.35, workdayProb: 0.85 },
    ],
    obligations: [
      { kind: "rent", category: "housing", amount: 4000, day: 6, jitter: 2 },
      { kind: "mobile", category: "mobile_topup", amount: 300, day: 15, jitter: 5 },
    ],
    dailySpend: {
      mean: 55, stdFrac: 0.3, skipProb: 0.05,
      categories: { transport: 0.5, food_beverage: 0.4, shopping: 0.1 },
      frontload: null,
    },
    cashout: { perMonth: [6, 10], amount: [500, 1200], sameAgentProb: 0.6, digitalFollowProb: 0.35 },
    shock: { probPerMonth: 0.18, amount: [1000, 4000] },
  },

  remittance_household: {
    id: "remittance_household",
    name: "Jamila Khatun",
    labelBn: "রেমিট্যান্স-নির্ভর পরিবার",
    labelEn: "Remittance household",
    ageBand: "35-44",
    region: "sylhet",
    incomeBand: "25k-40k",
    historyMonths: [10, 12],
    startBalance: 5000,
    incomeStreams: [
      { kind: "every_days", type: "remittance_in", amount: 25000, intervalDays: 35, intervalJitter: 10, amountJitterFrac: 0.2, dailyMean: 0 },
    ],
    obligations: [
      { kind: "rent", category: "housing", amount: 8000, day: 5, jitter: 2 },
      { kind: "bills", category: "utilities", amount: 2500, day: 9, jitter: 3 },
      { kind: "mobile", category: "mobile_topup", amount: 400, day: 12, jitter: 4 },
    ],
    dailySpend: {
      mean: 150, stdFrac: 0.4, skipProb: 0.08,
      categories: { groceries: 0.6, transport: 0.15, shopping: 0.25 },
      frontload: { startDay: 1, endDay: 10, share: 0.45 },
    },
    cashout: { perMonth: [4, 6], amount: [1200, 2000], sameAgentProb: 0.7, digitalFollowProb: 0.3 },
    shock: { probPerMonth: 0.2, amount: [2000, 5000] },
  },

  shopkeeper: {
    id: "shopkeeper",
    name: "Rafiq Ahmed",
    labelBn: "ছোট ব্যবসায়ী",
    labelEn: "Small shopkeeper",
    ageBand: "35-44",
    region: "chattogram",
    incomeBand: "25k-40k",
    historyMonths: [10, 12],
    startBalance: 8000,
    incomeStreams: [
      { kind: "daily_mean", type: "cash_in", amount: 0, dailyMean: 3200, dailyStdFrac: 0.45, workdayProb: 0.9 },
    ],
    obligations: [
      { kind: "supplier", category: "send_money", amount: 5000, everyDays: 7 },
      { kind: "rent", category: "housing", amount: 10000, day: 4, jitter: 2 },
      { kind: "bills", category: "utilities", amount: 1800, day: 11, jitter: 3 },
    ],
    dailySpend: {
      mean: 60, stdFrac: 0.35, skipProb: 0.08,
      categories: { groceries: 0.55, transport: 0.2, food_beverage: 0.25 },
      frontload: null,
    },
    cashout: { perMonth: [9, 14], amount: [1500, 3500], sameAgentProb: 0.75, digitalFollowProb: 0.3 },
    shock: { probPerMonth: 0.22, amount: [2000, 6000] },
  },

  student: {
    id: "student",
    name: "Anik Rahman",
    labelBn: "শিক্ষার্থী",
    labelEn: "Student",
    ageBand: "18-24",
    region: "rajshahi",
    incomeBand: "under-15k",
    historyMonths: [3, 6], // low-data case → persona priors
    startBalance: 800,
    incomeStreams: [
      { kind: "day_of_month", type: "cash_in", amount: 6000, dayOfMonth: 3, dayJitter: 3, skipProb: 0.2, amountJitterFrac: 0.25, dailyMean: 0 },
    ],
    obligations: [
      { kind: "mobile", category: "mobile_topup", amount: 300, day: 8, jitter: 6 },
    ],
    dailySpend: {
      mean: 15, stdFrac: 0.5, skipProb: 0.25,
      categories: { food_beverage: 0.6, transport: 0.2, shopping: 0.2 },
      frontload: { startDay: 3, endDay: 9, share: 0.5 },
    },
    cashout: { perMonth: [1, 3], amount: [300, 800], sameAgentProb: 0.5, digitalFollowProb: 0.25 },
    shock: { probPerMonth: 0.1, amount: [500, 1500] },
  },
};

export const SATHI_PERSONA_IDS = Object.keys(SATHI_PERSONAS);

/** Demo-user listing shape (Sathi /v1/demo-users). */
export interface DemoUserItem {
  user_id: string;
  persona: string;
  persona_label_bn: string;
  persona_label_en: string;
  age_band: string;
  region: string;
  income_band: string;
}

export function demoUsers(): DemoUserItem[] {
  return SATHI_PERSONA_IDS.map((id) => {
    const p = SATHI_PERSONAS[id];
    return {
      user_id: id,
      persona: id,
      persona_label_bn: p.labelBn,
      persona_label_en: p.labelEn,
      age_band: p.ageBand,
      region: p.region,
      income_band: p.incomeBand,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Persona history generator (port of data_gen behaviour)              */
/* ------------------------------------------------------------------ */

function txn(
  ts: Date, amount: number, direction: Direction, category: string,
  subcategory: string | null, merchant: string | null, channel: string,
): SyntheticTxn {
  return {
    timestamp: ts, amount, currency: "BDT", direction, category, subcategory,
    merchant, channel, source: "synthetic", classificationConfidence: 1,
  };
}

function monthDay(anchor: Date, monthsBack: number, day: number, hour: number, rng: Rng): Date {
  const base = new Date(anchor.getFullYear(), anchor.getMonth() - monthsBack, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(Math.max(1, day), lastDay));
  base.setHours(hour, rng.int(0, 59), 0, 0);
  return base;
}

/**
 * Generate one persona's wallet history ending at `anchor`.
 * Deterministic per (persona, seed).
 */
export function generateSathiPersonaHistory(
  personaId: string,
  anchor: Date,
  seed: number,
): { txns: SyntheticTxn[]; openingBalance: number } {
  const spec = SATHI_PERSONAS[personaId];
  if (!spec) throw new Error(`Unknown Sathi persona: ${personaId}`);
  const rng = makeRng(seed);
  const months = rng.int(spec.historyMonths[0], spec.historyMonths[1]);
  const txns: SyntheticTxn[] = [];

  // Remittance interval state (persists across months).
  let remittanceDaysAway = spec.incomeStreams
    .find((s) => s.kind === "every_days")?.intervalDays ?? 35;

  for (let m = months - 1; m >= 0; m--) {
    /* ---- income streams ---- */
    for (const stream of spec.incomeStreams) {
      if (stream.kind === "day_of_month") {
        if (stream.skipProb && rng.chance(stream.skipProb)) continue;
        let day = (stream.dayOfMonth ?? 1) + rng.int(-(stream.dayJitter ?? 0), stream.dayJitter ?? 0);
        if (stream.lateProb && rng.chance(stream.lateProb)) day += stream.lateDays ?? 0;
        const amount = Math.max(
          0, Math.round(rng.normal(stream.amount, stream.amount * (stream.amountJitterFrac ?? 0))),
        );
        if (amount > 0) {
          txns.push(txn(
            monthDay(anchor, m, day, 10, rng), amount, "in", "income",
            stream.type === "salary_in" ? "salary" : "transfer",
            stream.type === "salary_in" ? "Garment Factory Payroll" : "Family Support",
            "bank_transfer",
          ));
        }
      } else if (stream.kind === "every_days") {
        remittanceDaysAway -= 30; // month passed
        while (remittanceDaysAway <= 0) {
          const arrivalDay = 30 + remittanceDaysAway + rng.int(0, stream.intervalJitter ?? 0);
          const amount = Math.max(0, Math.round(rng.normal(stream.amount, stream.amount * (stream.amountJitterFrac ?? 0))));
          if (amount > 0) {
            txns.push(txn(
              monthDay(anchor, m, Math.max(1, Math.min(28, arrivalDay)), 12, rng),
              amount, "in", "income", "remittance", "Remittance (bidesh)", "bank_transfer",
            ));
          }
          remittanceDaysAway += stream.intervalDays ?? 35;
        }
      } else if (stream.kind === "daily_mean") {
        // daily earnings: walk days of this month
        const base = new Date(anchor.getFullYear(), anchor.getMonth() - m, 1);
        const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= lastDay; d++) {
          const ts = new Date(base.getFullYear(), base.getMonth(), d, rng.int(9, 21), rng.int(0, 59));
          if (ts > anchor) break;
          if (stream.workdayProb && !rng.chance(stream.workdayProb)) continue;
          const amount = Math.max(0, Math.round(rng.normal(stream.dailyMean, stream.dailyMean * (stream.dailyStdFrac ?? 0.3))));
          if (amount >= 50) {
            txns.push(txn(ts, amount, "in", "income", "daily_earnings", "Daily Earnings", "wallet"));
          }
        }
      }
    }

    /* ---- obligations ---- */
    for (const ob of spec.obligations) {
      if (ob.everyDays) {
        // interval-based (e.g. weekly supplier) — emit every N days
        const base = new Date(anchor.getFullYear(), anchor.getMonth() - m, 1);
        const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
        for (let d = ob.everyDays; d <= lastDay; d += ob.everyDays) {
          const ts = new Date(base.getFullYear(), base.getMonth(), d, 11, rng.int(0, 59));
          if (ts > anchor) break;
          txns.push(txn(ts, ob.amount, "out", ob.category, ob.kind, ob.kind === "supplier" ? "Wholesale Supplier" : "Landlord", "wallet"));
        }
      } else {
        const day = (ob.day ?? 5) + rng.int(-(ob.jitter ?? 0), ob.jitter ?? 0);
        txns.push(txn(monthDay(anchor, m, day, 11, rng), ob.amount, "out", ob.category, ob.kind, ob.kind === "rent" ? "Landlord" : null, "wallet"));
      }
    }

    /* ---- daily spend (front-loaded after income where specified) ---- */
    const base = new Date(anchor.getFullYear(), anchor.getMonth() - m, 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    // Reference frontload: redistribute a fixed share of the month's spend
    // into the window (total unchanged) — NOT an across-the-board lift.
    const fl = spec.dailySpend.frontload;
    let frontloadFactor = 1;
    if (fl) {
      const nIn = fl.endDay - fl.startDay + 1;
      const nOut = Math.max(30 - nIn, 1);
      frontloadFactor = (fl.share * nOut) / ((1 - fl.share) * nIn);
    }
    for (let d = 1; d <= lastDay; d++) {
      const ts = new Date(base.getFullYear(), base.getMonth(), d, rng.int(8, 21), rng.int(0, 59));
      if (ts > anchor) break;
      if (rng.chance(spec.dailySpend.skipProb)) continue;
      let amount = Math.max(20, Math.round(rng.normal(spec.dailySpend.mean, spec.dailySpend.mean * spec.dailySpend.stdFrac)));
      if (fl && d >= fl.startDay && d <= fl.endDay) amount = Math.round(amount * frontloadFactor);
      if (amount < 10) continue;
      // category by configured share
      const cats = Object.entries(spec.dailySpend.categories);
      let pick = rng.next();
      let category = cats[cats.length - 1][0];
      for (const [c, share] of cats) {
        pick -= share;
        if (pick <= 0) {
          category = c;
          break;
        }
      }
      txns.push(txn(ts, amount, "out", category, null, rng.pick(DIGITAL_MERCHANTS), "wallet"));
    }

    /* ---- cash-outs with digital-substitution injection ---- */
    const nCashouts = rng.int(spec.cashout.perMonth[0], spec.cashout.perMonth[1]);
    let favouriteAgent = rng.pick(AGENTS);
    for (let k = 0; k < nCashouts; k++) {
      const day = rng.int(2, 28);
      const amount = rng.int(spec.cashout.amount[0], spec.cashout.amount[1]);
      const agent = rng.chance(spec.cashout.sameAgentProb) ? favouriteAgent : rng.pick(AGENTS);
      favouriteAgent = agent;
      txns.push(txn(monthDay(anchor, m, day, 15, rng), amount, "out", "cash_out", null, agent, "agent"));
      // digital follow: a merchant payment within 2 days that could have been digital
      if (rng.chance(spec.cashout.digitalFollowProb)) {
        const followDay = Math.min(28, day + rng.int(1, 2));
        txns.push(txn(
          monthDay(anchor, m, followDay, 17, rng),
          Math.round(amount * (0.5 + rng.next() * 0.4)),
          "out", rng.pick(["groceries", "utilities", "health"]), null,
          rng.pick(DIGITAL_MERCHANTS), "wallet",
        ));
      }
    }

    /* ---- rare shock ---- */
    if (rng.chance(spec.shock.probPerMonth)) {
      txns.push(txn(
        monthDay(anchor, m, rng.int(3, 26), 14, rng),
        rng.int(spec.shock.amount[0], spec.shock.amount[1]),
        "out", "health", "emergency", "Emergency", "wallet",
      ));
    }
  }

  /* ---- reference insufficient-balance rule (documented ASSUMPTION) ----
   * Inflows are applied first each day; an outflow that exceeds the wallet
   * balance is skipped (paid late or in cash — invisible to the wallet).
   * This keeps every balance_after non-negative, exactly like the
   * reference data generator. */
  const openingBalance = Math.max(
    0,
    spec.startBalance + rng.int(-Math.round(spec.startBalance * 0.2), Math.round(spec.startBalance * 0.2)),
  );
  const byDay = new Map<string, SyntheticTxn[]>();
  for (const t of txns) {
    const key = t.timestamp.toISOString().slice(0, 10);
    const arr = byDay.get(key) ?? [];
    arr.push(t);
    byDay.set(key, arr);
  }
  const kept: SyntheticTxn[] = [];
  let balance = openingBalance;
  const anchorMs = anchor.getTime();
  for (const day of [...byDay.keys()].sort()) {
    const events = byDay.get(day)!;
    // inflows first
    for (const e of events.filter((e) => e.direction === "in").sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      if (e.timestamp.getTime() > anchorMs) continue; // not happened yet
      balance += e.amount;
      kept.push(e);
    }
    // then outflows in time order, skipping any the wallet cannot cover
    for (const e of events.filter((e) => e.direction === "out").sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
      if (e.timestamp.getTime() > anchorMs) continue; // not happened yet
      if (e.amount > balance) continue; // paid late or in cash — skipped
      balance -= e.amount;
      kept.push(e);
    }
  }

  const sorted = kept.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return {
    txns: sorted,
    openingBalance,
  };
}
