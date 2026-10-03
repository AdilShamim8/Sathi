/**
 * Synthetic data generator — demo customer + ML training population.
 *
 * Demo customer ("Adil Shamim" default): 6 months of wallet history, salary ৳30,000
 * on the 1st–3rd, with documented injected patterns (see generateDemo).
 *
 * ML training population: personas × income levels × volatility, 6 months
 * each, with varying shortfall pressure so the risk classifier has both
 * classes to learn from. All seeded → fully reproducible; no real PII.
 *
 * Documented synthetic assumptions (hackathon data strategy):
 *  - salary lands on a fixed day-of-month with ±2 jitter
 *  - rent/utilities/remittance are monthly obligations
 *  - month-end discretionary spend and cash-outs are elevated for strained personas
 *  - gig income is irregular; remittance arrives every 2 months for some personas
 */
import { makeRng } from "./rng";
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

const COFFEE_MERCHANTS = ["North End Coffee", "Crimson Cup", "Star Kabab Cafe", "Arogya Cafe"];
const GROCERY_MERCHANTS = ["Meena Bazar", "Shwapno", "Agora Super Shop", "Daily Shopping"];
const FOOD_MERCHANTS = ["Sultans Dine", "Kacchi Bhai", "Pizza Hut", "Chillox", "Local Hotel"];
const TRANSPORT = ["Pathao", "Uber", "CNG", "Rickshaw", "Metro Rail"];
const SHOPPING = ["Daraz", "Aarong", "Bata", "Yellow"];

/** Date in the month that is `monthsBack` calendar months before anchor. */
function md(anchor: Date, monthsBack: number, dayOfMonth: number, hour: number, minute: number): Date {
  const d = new Date(anchor.getFullYear(), anchor.getMonth() - monthsBack, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dayOfMonth, lastDay));
  d.setHours(hour, minute, 0, 0);
  return d;
}

function out(ts: Date, amount: number, category: string, subcategory: string | null, merchant: string | null, channel = "wallet"): SyntheticTxn {
  return { timestamp: ts, amount, currency: "BDT", direction: "out", category, subcategory, merchant, channel, source: "synthetic", classificationConfidence: 1 };
}

function income(ts: Date, amount: number, merchant: string): SyntheticTxn {
  return { timestamp: ts, amount, currency: "BDT", direction: "in", category: "income", subcategory: "salary", merchant, channel: "bank_transfer", source: "synthetic", classificationConfidence: 1 };
}

/* ------------------------------------------------------------------ */
/* Demo customer                                                       */
/* ------------------------------------------------------------------ */

/**
 * Injected, documented patterns:
 *  1. salary inflow on the 1st–3rd of each month (৳30,000)
 *  2. recurring: rent (5th), internet (10th), family remittance (15th)
 *  3. coffee habit growing month-over-month
 *  4. month-end cash pressure: cash-outs and discretionary spend elevated on days 21–31
 *  5. frequent cash-out behaviour (3×/month, larger at month-end)
 *  6. one unusual dining spike (anomaly) in the previous month
 *  7. seasonal shopping lift in the middle period ("festival month")
 */
export function generateDemoTransactions(anchor: Date, seed = 42): SyntheticTxn[] {
  const rng = makeRng(seed);
  const txns: SyntheticTxn[] = [];
  const MONTHS = 6;

  for (let m = MONTHS - 1; m >= 0; m--) {
    const recency = MONTHS - 1 - m; // 0 = oldest month

    // 1. salary on the 1st–3rd (current month: 1st–2nd at 9am so it lands
    //    before "now" whenever the demo boots mid-morning or later)
    const salaryDay = m === 0 ? rng.int(1, 2) : rng.int(1, 3);
    const salaryHour = m === 0 ? 9 : 10;
    txns.push(income(md(anchor, m, salaryDay, salaryHour, rng.int(0, 59)), 30000, "Employer Payroll"));

    // occasional freelance inflow (~50% of months)
    if (rng.chance(0.5)) {
      txns.push(income(md(anchor, m, rng.int(10, 20), 15, rng.int(0, 59)), rng.int(1500, 4000), "Freelance Client"));
    }

    // 2. recurring essentials
    txns.push(out(md(anchor, m, 5, 11, 30), 7500, "housing", "rent", "Landlord H. Rahman"));
    txns.push(out(md(anchor, m, 10, 9, 15), 800, "utilities", "internet", "Link3 Broadband"));
    txns.push(out(md(anchor, m, rng.int(7, 12), 18, 0), rng.int(1200, 1700), "utilities", "electricity", "DESCO Bill"));
    txns.push(out(md(anchor, m, 15, 20, 0), 2500, "send_money", "family", "Amma (Kushtia)"));
    for (let k = 0; k < 2; k++) {
      txns.push(out(md(anchor, m, rng.int(3, 27), 12, rng.int(0, 59)), rng.int(199, 299), "mobile_topup", "flexiload", "Grameenphone"));
    }

    // groceries — weekly, one top-up lands late in the month
    for (let w = 0; w < 4; w++) {
      const dayOfMonth = w === 3 ? rng.int(22, 27) : w * 7 + rng.int(1, 3);
      txns.push(out(md(anchor, m, dayOfMonth, 19, rng.int(0, 59)), rng.int(900, 1400), "groceries", "weekly_bazar", rng.pick(GROCERY_MERCHANTS)));
    }

    // 3. coffee — growing habit: 4 + 1.4*recency cups per month
    const coffeeCount = Math.round(4 + recency * 1.4);
    for (let c = 0; c < coffeeCount; c++) {
      txns.push(out(md(anchor, m, rng.int(1, 28), rng.int(9, 21), rng.int(0, 59)), rng.pick([150, 180, 200, 200, 220, 250]), "food_beverage", "coffee", rng.pick(COFFEE_MERCHANTS)));
    }

    // dining out — skewed toward the late-month dry spell (pattern 4)
    const dineCount = rng.int(3, 4);
    for (let c = 0; c < dineCount; c++) {
      const dayOfMonth = rng.chance(0.65) ? rng.int(20, 28) : rng.int(1, 19);
      txns.push(out(md(anchor, m, dayOfMonth, rng.int(13, 22), rng.int(0, 59)), rng.int(280, 650), "food_beverage", "restaurant", rng.pick(FOOD_MERCHANTS)));
    }

    // transport — ~17 rides
    for (let t = 0; t < 17; t++) {
      if (rng.chance(0.85)) {
        txns.push(out(md(anchor, m, rng.int(1, 28), rng.int(8, 20), rng.int(0, 59)), rng.int(40, 140), "transport", "commute", rng.pick(TRANSPORT)));
      }
    }

    // 5. cash-out — 3×/month, larger during the late-month dry spell
    txns.push(out(md(anchor, m, rng.int(4, 9), 14, 30), rng.int(800, 1200), "cash_out", null, "Agent Point", "agent"));
    txns.push(out(md(anchor, m, rng.int(22, 25), 15, 0), rng.int(1100, 1500), "cash_out", null, "Agent Point", "agent"));
    txns.push(out(md(anchor, m, rng.int(26, 28), 15, 30), rng.int(1700, 2200), "cash_out", null, "Agent Point", "agent"));

    // entertainment subscription
    txns.push(out(md(anchor, m, 3, 8, 0), 349, "entertainment", "subscription", "Chorki"));

    // 7. festival shopping lift in the middle period
    if (recency === 3) {
      txns.push(out(md(anchor, m, 12, 16, 0), 3200, "shopping", "clothes", rng.pick(SHOPPING)));
      txns.push(out(md(anchor, m, 14, 17, 30), 1900, "shopping", "gifts", rng.pick(SHOPPING)));
    }

    // health, occasional
    if (rng.chance(0.6)) {
      txns.push(out(md(anchor, m, rng.int(5, 25), 11, 0), rng.int(350, 1200), "health", "pharmacy", "Lazz Pharma"));
    }
  }

  // 6. one unusual dining spike in the previous month (anomaly)
  txns.push(out(md(anchor, 1, rng.int(5, 20), 21, 5), 2200, "food_beverage", "restaurant", "Sultans Dine"));

  // a couple of NL-captured demo transactions in recent days
  const nl = out(new Date(anchor.getTime() - 2 * 24 * 3600 * 1000), 200, "food_beverage", "coffee", "North End Coffee");
  nl.source = "natural_language_input";
  nl.classificationConfidence = 0.92;
  txns.push(nl);

  return txns
    .filter((t) => t.timestamp.getTime() <= anchor.getTime())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/* ------------------------------------------------------------------ */
/* ML training population                                              */
/* ------------------------------------------------------------------ */

export type PersonaId =
  | "salaried_stable"    // decent salary, stable spend, saves
  | "salaried_tight"     // salary barely covers obligations
  | "gig_mixed"          // irregular gig income + moderate spend
  | "remittance_family"  // remittance every ~2 months + household spend
  | "student_lean"       // small allowance, frugal
  | "volatile_spender";  // decent income, high discretionary + cash-outs

interface PersonaSpec {
  salary: [number, number];       // range
  payDay: number;                 // day of month (salaried) or -1 irregular
  otherIncome: "none" | "freelance" | "remittance";
  rent: number;
  remittance: number;             // family support per month
  groceries: [number, number];    // per trip, weekly
  discretionary: [number, number]; // count per month
  discAmount: [number, number];
  cashOutPerMonth: number;
  cashOutAmount: [number, number];
  openingBalance: number;
}

const PERSONAS: Record<PersonaId, PersonaSpec> = {
  salaried_stable: { salary: [40000, 55000], payDay: 2, otherIncome: "freelance", rent: 12000, remittance: 2000, groceries: [1200, 1800], discretionary: [3, 5], discAmount: [200, 700], cashOutPerMonth: 2, cashOutAmount: [1000, 2000], openingBalance: 60000 },
  salaried_tight: { salary: [18000, 24000], payDay: 5, otherIncome: "none", rent: 7000, remittance: 2500, groceries: [900, 1300], discretionary: [4, 7], discAmount: [200, 600], cashOutPerMonth: 4, cashOutAmount: [1200, 2500], openingBalance: 14000 },
  gig_mixed: { salary: [12000, 20000], payDay: -1, otherIncome: "freelance", rent: 6000, remittance: 1000, groceries: [800, 1200], discretionary: [3, 6], discAmount: [150, 500], cashOutPerMonth: 3, cashOutAmount: [1000, 2200], openingBalance: 22000 },
  remittance_family: { salary: [0, 0], payDay: -1, otherIncome: "remittance", rent: 5000, remittance: 0, groceries: [1000, 1600], discretionary: [2, 5], discAmount: [150, 600], cashOutPerMonth: 5, cashOutAmount: [1500, 3000], openingBalance: 30000 },
  student_lean: { salary: [6000, 9000], payDay: 8, otherIncome: "none", rent: 3500, remittance: 500, groceries: [500, 900], discretionary: [2, 4], discAmount: [100, 350], cashOutPerMonth: 2, cashOutAmount: [500, 1200], openingBalance: 8000 },
  volatile_spender: { salary: [30000, 42000], payDay: 3, otherIncome: "freelance", rent: 10000, remittance: 2000, groceries: [1100, 1700], discretionary: [10, 16], discAmount: [300, 900], cashOutPerMonth: 6, cashOutAmount: [1800, 4000], openingBalance: 20000 },
};

export const PERSONA_LABELS: Record<PersonaId, string> = {
  salaried_stable: "Salaried — stable",
  salaried_tight: "Salaried — tight budget",
  gig_mixed: "Gig / irregular income",
  remittance_family: "Remittance household",
  student_lean: "Student — lean",
  volatile_spender: "Volatile spender",
};

/** One synthetic user's history for the ML population. */
export function generatePersonaHistory(
  persona: PersonaId,
  anchor: Date,
  seed: number,
  months = 6,
): { txns: SyntheticTxn[]; openingBalance: number } {
  const rng = makeRng(seed);
  const spec = PERSONAS[persona];
  const txns: SyntheticTxn[] = [];
  const salary = Math.round(rng.normal((spec.salary[0] + spec.salary[1]) / 2 || 0, (spec.salary[1] - spec.salary[0]) / 6));
  const payDay = spec.payDay > 0 ? Math.max(1, Math.min(28, spec.payDay + rng.int(-1, 1))) : -1;

  for (let m = months - 1; m >= 0; m--) {
    // salary (fixed day with jitter) or weekly gig payouts
    if (payDay > 0 && salary > 0) {
      txns.push(income(md(anchor, m, payDay, 10, rng.int(0, 59)), salary, "Employer Payroll"));
    } else if (spec.otherIncome === "freelance") {
      for (let w = 0; w < 4; w++) {
        if (rng.chance(0.75)) {
          txns.push(income(md(anchor, m, w * 7 + rng.int(1, 5), rng.int(9, 20), rng.int(0, 59)), Math.round(rng.normal(salary / 4, salary / 10)), "Gig Platform Payout"));
        }
      }
    }

    // remittance every ~2 months
    if (spec.otherIncome === "remittance" && m % 2 === 0) {
      txns.push(income(md(anchor, m, rng.int(4, 12), 11, rng.int(0, 59)), Math.round(rng.normal(28000, 5000)), "Remittance (bidesh)"));
    } else if (spec.otherIncome === "freelance" && payDay > 0 && rng.chance(0.4)) {
      txns.push(income(md(anchor, m, rng.int(10, 22), 15, rng.int(0, 59)), rng.int(1500, 5000), "Freelance Client"));
    }

    // obligations
    txns.push(out(md(anchor, m, Math.min(28, Math.abs(payDay) + 3 || 5), 11, 0), spec.rent, "housing", "rent", "Landlord"));
    txns.push(out(md(anchor, m, rng.int(8, 12), 18, 0), rng.int(800, 1600), "utilities", "electricity", "DESCO Bill"));
    if (spec.remittance > 0) {
      txns.push(out(md(anchor, m, rng.int(13, 17), 20, 0), spec.remittance, "send_money", "family", "Family"));
    }
    txns.push(out(md(anchor, m, rng.int(2, 5), 8, 0), 349, "entertainment", "subscription", rng.pick(["Chorki", "Hoichoi"])));

    // groceries weekly
    for (let w = 0; w < 4; w++) {
      txns.push(out(md(anchor, m, w * 7 + rng.int(1, 4), 19, rng.int(0, 59)), Math.round(rng.normal((spec.groceries[0] + spec.groceries[1]) / 2, 150)), "groceries", "bazar", rng.pick(GROCERY_MERCHANTS)));
    }

    // discretionary — month-end skewed
    const discCount = rng.int(spec.discretionary[0], spec.discretionary[1]);
    for (let c = 0; c < discCount; c++) {
      const dayOfMonth = rng.chance(0.55) ? rng.int(20, 28) : rng.int(1, 19);
      txns.push(out(md(anchor, m, dayOfMonth, rng.int(12, 22), rng.int(0, 59)), rng.int(spec.discAmount[0], spec.discAmount[1]), rng.chance(0.6) ? "food_beverage" : "shopping", null, rng.pick(FOOD_MERCHANTS)));
    }

    // transport
    for (let t = 0; t < 14; t++) {
      if (rng.chance(0.8)) {
        txns.push(out(md(anchor, m, rng.int(1, 28), rng.int(8, 20), rng.int(0, 59)), rng.int(40, 160), "transport", "commute", rng.pick(TRANSPORT)));
      }
    }

    // cash-outs — month-end larger
    for (let k = 0; k < spec.cashOutPerMonth; k++) {
      const late = k >= spec.cashOutPerMonth - 2;
      txns.push(out(md(anchor, m, late ? rng.int(22, 28) : rng.int(4, 18), 15, rng.int(0, 59)), rng.int(spec.cashOutAmount[0], spec.cashOutAmount[1]), "cash_out", null, "Agent Point", "agent"));
    }
  }

  return {
    txns: txns.filter((t) => t.timestamp.getTime() <= anchor.getTime()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    openingBalance: spec.openingBalance + rng.int(-1500, 1500),
  };
}

/** The full training population: personas × variations, deterministic seeds. */
export function generateTrainingPopulation(anchor: Date, perPersona = 9, months = 6): {
  persona: PersonaId;
  userIdx: number;
  txns: SyntheticTxn[];
  openingBalance: number;
}[] {
  const out: { persona: PersonaId; userIdx: number; txns: SyntheticTxn[]; openingBalance: number }[] = [];
  const personaIds = Object.keys(PERSONAS) as PersonaId[];
  let idx = 0;
  for (const p of personaIds) {
    for (let k = 0; k < perPersona; k++) {
      const seed = 1000 + idx * 37 + k * 7;
      const h = generatePersonaHistory(p, anchor, seed, months);
      out.push({ persona: p, userIdx: idx, ...h });
      idx++;
    }
  }
  return out;
}
