/**
 * Sathi configuration — faithful port of the reference repo's config/*.yaml.
 *
 * Every number is a named, documented ASSUMPTION (docs/assumptions.md in the
 * reference repo). Nothing is hardcoded at the point of use: engines read
 * these values, and the evidence block surfaces them to the user.
 *
 * Units follow the reference convention: money in integer paisa (100 paisa =
 * ৳1), rates in integer basis points (100 bps = 1%). Use paisaToTaka() when
 * bridging into this app's whole-taka engines.
 */

import { paisaToTaka } from "./money";

/* ---------------- fees.yaml ---------------- */
export const FEES = {
  /** ASSUMPTION FEE_CASHOUT_RATE: illustrative cash-out fee to an agent (1.5%). */
  cash_out_bps: 150,
  /** Illustrative minimum fee ৳5.00. */
  cash_out_min_paisa: 500,
  /** ASSUMPTION FEE_DIGITAL_PAYMENT_RATE: merchant payments assumed free. */
  digital_payment_bps: 0,
  /** ASSUMPTION FEE_SEND_MONEY: P2P send assumed free in the synthetic world. */
  send_money_bps: 0,
} as const;

/* ---------------- thresholds.yaml ---------------- */
export const THRESHOLDS = {
  /** ASSUMPTION ESSENTIALS_PER_DAY: minimum daily essential spend (৳350/day). */
  essentials_per_day_paisa: 35000,
  /** ASSUMPTION SHORTFALL_HORIZON_DAYS: shortfall alert lookahead cap. */
  shortfall_horizon_days: 21,
  /** ASSUMPTION SHORTFALL_ALERT_LEAD_DAYS: early-warning evaluation lead time. */
  shortfall_alert_lead_days: 7,
  /** ASSUMPTION SHORTFALL_FLOOR_DAYS (ML handoff): a shortfall is an end-of-day
   * wallet balance below this many days of the user's own median daily
   * outflow (computed from history before the forecast origin). A personal
   * floor keeps the label meaningful across income levels. */
  shortfall_floor_days: 3,
  /** ASSUMPTION MIN_BUFFER_DAYS: planner never pushes balance below this. */
  min_buffer_days: 3,
  /** Minimum history before per-user models are trusted. */
  min_history_days: 45,
  min_history_transactions: 20,
  /** Minimum sane monthly goal contribution (৳500). */
  min_goal_monthly_contribution_paisa: 50000,
} as const;

/** Essentials per day in whole taka (for this app's taka-based engines). */
export const ESSENTIALS_PER_DAY_TAKA = paisaToTaka(THRESHOLDS.essentials_per_day_paisa);

/* ---------------- risk.yaml ---------------- */
export const RISK_BANDS = {
  /** P(shortfall) < low_cutoff → "low". */
  low_cutoff: 0.2,
  /** low_cutoff ≤ P < high_cutoff → "watch". */
  high_cutoff: 0.5,
} as const;

export type RiskLevel = "low" | "watch" | "high";

export function bandRisk(p: number): RiskLevel {
  if (p >= RISK_BANDS.high_cutoff) return "high";
  if (p >= RISK_BANDS.low_cutoff) return "watch";
  return "low";
}

/* ---------------- calendar.yaml ---------------- */
export const CALENDAR = {
  /** ASSUMPTION FESTIVAL_DAYS: approximate festival dates (spending multipliers). */
  festival_days: [
    "2026-03-19", // Eid al-Fitr (approximate)
    "2026-03-20",
    "2026-03-21",
    "2026-05-27", // Eid al-Adha (approximate)
    "2026-05-28",
    "2026-04-14", // Pohela Boishakh
  ],
  /** Eid days (first day); garment wages carry an Eid bonus a week before
   * (ML handoff: used by the reference data generator). */
  eid_days: ["2026-03-19", "2026-05-27"] as const,
  festival_spend_multiplier: 1.8,
  festival_lead_days: 3,
} as const;

/* ---------------- app.yaml (planner / simulation / detector / limits) ---------------- */
export const PLANNER_CONFIG = {
  n_simulations: 2000,
  timeout_s: 5,
  horizon_cap_months: 36,
  min_monthly_contribution_paisa: 10000, // ৳100 floor
  seed: 77031,
  likely_cutoff: 0.7,
  uncertain_cutoff: 0.4,
} as const;

export const SIMULATION_CONFIG = {
  n_paths: 400,
  block_length_days: 5,
  seed: 44021,
  spread_scale_min: 0.5,
  spread_scale_max: 2.0,
  prior_std_ratio: 0.6,
} as const;

export const CASHOUT_DETECTOR = {
  /** cash-outs to the same agent to count as a habit. */
  min_repeat: 3,
  /** payment within this many days counts as "used the cash". */
  follow_days: 2,
  /** payment ≥ this share of the withdrawn amount. */
  min_amount_frac: 0.5,
} as const;

export const RATE_LIMITS = {
  window_s: 60,
  chat_per_window: 10,
  parse_amount_per_window: 20,
  demo_login_per_window: 10,
} as const;

/* ---------------- app.yaml (goal types) ---------------- */
export interface GoalTypeDef {
  id: string;
  labelBn: string;
  labelEn: string;
}

export const GOAL_TYPES: GoalTypeDef[] = [
  { id: "emergency_fund", labelBn: "জরুরি তহবিল", labelEn: "Emergency fund" },
  { id: "education", labelBn: "শিক্ষা", labelEn: "Education" },
  { id: "device", labelBn: "ডিভাইস", labelEn: "Device" },
  { id: "family_need", labelBn: "পারিবারিক প্রয়োজন", labelEn: "Family need" },
  { id: "travel", labelBn: "ভ্রমণ", labelEn: "Travel" },
  { id: "other", labelBn: "অন্যান্য", labelEn: "Other" },
];

export const LOCALE_DEFAULT = "bn" as const;
export const LOCALE_SUPPORTED = ["bn", "en"] as const;

/** Stable config fingerprint (surfaced in the evidence block). */
export function configHash(): string {
  const canon = JSON.stringify({
    FEES, THRESHOLDS, RISK_BANDS, CALENDAR, PLANNER_CONFIG, SIMULATION_CONFIG, CASHOUT_DETECTOR,
  });
  // FNV-1a 32-bit — deterministic, dependency-free.
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
