/**
 * Input validation shared by the transaction and goal CRUD routes.
 * Every rule returns a ready-to-send 400 message; handlers just pass it
 * through so the client always gets actionable feedback.
 */
import { ALL_CATEGORIES } from "@/lib/engine/domain";

const CATEGORY_IDS = new Set(ALL_CATEGORIES.map((c) => c.id));
const MAX_AMOUNT = 10_000_000; // ৳1 crore whole taka
const DIRECTIONS = new Set(["in", "out"]);

export interface TxnInput {
  amount: number;
  direction: "in" | "out";
  category: string;
  merchant: string | null;
  timestamp: Date;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function parseIntField(v: unknown, label: string): Result<number> {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.-]/g, "")) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return { ok: false, error: `${label} must be a number` };
  return { ok: true, value: Math.round(n) };
}

/**
 * Validate transaction fields for manual creation. Strict on purpose:
 * a personal finance ledger must never hold malformed rows.
 */
export function validateTxnCreate(body: Record<string, unknown>): Result<TxnInput> {
  const amt = parseIntField(body.amount, "Amount");
  if (!amt.ok) return amt;
  if (amt.value < 1 || amt.value > MAX_AMOUNT) {
    return { ok: false, error: "Amount must be between ৳1 and ৳10,000,000" };
  }

  const direction = body.direction;
  if (typeof direction !== "string" || !DIRECTIONS.has(direction)) {
    return { ok: false, error: "Direction must be \"in\" or \"out\"" };
  }

  const category = body.category;
  if (typeof category !== "string" || !CATEGORY_IDS.has(category)) {
    return { ok: false, error: `Unknown category. Must be one of: ${[...CATEGORY_IDS].join(", ")}` };
  }

  let merchant: string | null = null;
  if (body.merchant !== undefined && body.merchant !== null && body.merchant !== "") {
    if (typeof body.merchant !== "string") return { ok: false, error: "Merchant must be text" };
    merchant = body.merchant.trim().slice(0, 120) || null;
  }

  let timestamp = new Date();
  if (body.timestamp !== undefined && body.timestamp !== null && body.timestamp !== "") {
    const d = new Date(String(body.timestamp));
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
    const now = Date.now();
    if (d.getTime() > now + 36 * 3600 * 1000) return { ok: false, error: "Date cannot be more than a day in the future" };
    if (d.getTime() < now - 400 * 24 * 3600 * 1000) return { ok: false, error: "Date cannot be more than ~13 months in the past" };
    timestamp = d;
  }

  return { ok: true, value: { amount: amt.value, direction: direction as "in" | "out", category, merchant, timestamp } };
}

export interface TxnPatch {
  amount?: number;
  direction?: "in" | "out";
  category?: string;
  merchant?: string | null;
  timestamp?: Date;
}

/** Validate a partial update (only the fields present are changed). */
export function validateTxnPatch(body: Record<string, unknown>): Result<TxnPatch> {
  const patch: TxnPatch = {};

  if (body.amount !== undefined) {
    const amt = parseIntField(body.amount, "Amount");
    if (!amt.ok) return amt;
    if (amt.value < 1 || amt.value > MAX_AMOUNT) {
      return { ok: false, error: "Amount must be between ৳1 and ৳10,000,000" };
    }
    patch.amount = amt.value;
  }

  if (body.direction !== undefined) {
    if (typeof body.direction !== "string" || !DIRECTIONS.has(body.direction)) {
      return { ok: false, error: "Direction must be \"in\" or \"out\"" };
    }
    patch.direction = body.direction as "in" | "out";
  }

  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !CATEGORY_IDS.has(body.category)) {
      return { ok: false, error: `Unknown category. Must be one of: ${[...CATEGORY_IDS].join(", ")}` };
    }
    patch.category = body.category;
  }

  if (body.merchant !== undefined) {
    if (body.merchant === null) {
      patch.merchant = null;
    } else {
      if (typeof body.merchant !== "string") return { ok: false, error: "Merchant must be text" };
      patch.merchant = body.merchant.trim().slice(0, 120) || null;
    }
  }

  if (body.timestamp !== undefined) {
    const d = new Date(String(body.timestamp));
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid date" };
    const now = Date.now();
    if (d.getTime() > now + 36 * 3600 * 1000) return { ok: false, error: "Date cannot be more than a day in the future" };
    if (d.getTime() < now - 400 * 24 * 3600 * 1000) return { ok: false, error: "Date cannot be more than ~13 months in the past" };
    patch.timestamp = d;
  }

  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update" };
  return { ok: true, value: patch };
}

export interface GoalPatch {
  name?: string;
  targetAmount?: number;
  months?: number;
  savedSoFar?: number;
  status?: string;
}

const GOAL_STATUSES = new Set(["active", "achieved", "dropped"]);

/** Validate a goal update; recompute monthlyCommitment where relevant. */
export function validateGoalPatch(body: Record<string, unknown>): Result<GoalPatch> {
  const patch: GoalPatch = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") return { ok: false, error: "Name must be text" };
    const name = body.name.trim();
    if (name.length < 2 || name.length > 160) return { ok: false, error: "Goal name must be 2-160 characters" };
    patch.name = name;
  }

  if (body.targetAmount !== undefined) {
    const amt = parseIntField(body.targetAmount, "Target amount");
    if (!amt.ok) return amt;
    if (amt.value < 1 || amt.value > 100_000_000) return { ok: false, error: "Target amount must be between ৳1 and ৳100,000,000" };
    patch.targetAmount = amt.value;
  }

  if (body.months !== undefined) {
    const m = parseIntField(body.months, "Months");
    if (!m.ok) return m;
    if (m.value < 1 || m.value > 120) return { ok: false, error: "Months must be between 1 and 120" };
    patch.months = m.value;
  }

  if (body.savedSoFar !== undefined) {
    const s = parseIntField(body.savedSoFar, "Saved so far");
    if (!s.ok) return s;
    if (s.value < 0 || s.value > 100_000_000) return { ok: false, error: "Saved so far must be between 0 and ৳100,000,000" };
    patch.savedSoFar = s.value;
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !GOAL_STATUSES.has(body.status)) {
      return { ok: false, error: "Status must be active, achieved or dropped" };
    }
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update" };
  return { ok: true, value: patch };
}
