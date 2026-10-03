/**
 * Server-side data layer: owner account lifecycle, queries, audit.
 *
 * The app is a single-owner personal product: exactly one User row has
 * role="owner" (the person using the device). Synthetic Sathi personas
 * (role="persona") power the reference-compatible /api/v1 surface and are
 * never mixed into the owner's numbers. All money is integer BDT.
 */
import { db } from "@/lib/db";
import { User, Transaction, Goal, Insight, KnowledgeDoc, AuditEvent, ForecastRecord } from "@prisma/client";
import { ensureSchema } from "@/lib/server/ensureSchema";
import { generateDemoTransactions } from "@/lib/engine/synthetic";
import { KNOWLEDGE_CORPUS } from "@/lib/engine/knowledge";
import type { Txn, Goal as GoalT } from "@/lib/engine/domain";

/** Default name offered at onboarding (the product owner). */
export const DEFAULT_USER_NAME = "Adil Shamim";

/** Synthetic personas from sathiPersonas.ts — used by the legacy migration. */
const PERSONA_USER_NAMES = ["Rina Begum", "Tariq Hasan", "Jamila Khatun", "Rafiq Ahmed", "Anik Rahman"];

function toTxn(t: Transaction): Txn {
  return {
    id: t.id,
    timestamp: t.timestamp.toISOString(),
    amount: t.amount,
    currency: t.currency,
    direction: t.direction as "in" | "out",
    category: t.category,
    subcategory: t.subcategory,
    merchant: t.merchant,
    channel: t.channel,
    source: t.source,
    classificationConfidence: t.classificationConfidence,
  };
}

/* ---------------- owner lifecycle ---------------- */

let rolesMigrated = false;

/**
 * One-time v4 migration for databases created before the role/mode fields:
 * every row defaulted to role="persona", so promote the legacy demo user
 * (the only non-persona user) to the owner. Idempotent and process-cached.
 */
async function migrateRolesOnce(): Promise<void> {
  if (rolesMigrated) return;
  const owner = await db.user.findFirst({ where: { role: "owner" } });
  if (!owner) {
    const legacy = await db.user.findFirst({
      where: { name: { notIn: PERSONA_USER_NAMES } },
      orderBy: { id: "asc" },
    });
    if (legacy) {
      await db.user.update({
        where: { id: legacy.id },
        data: { role: "owner", mode: "demo" }, // legacy seed data was synthetic
      });
    }
  }
  rolesMigrated = true;
}

/** The single device owner, or null before onboarding has completed. */
export async function getOwnerUser(): Promise<User | null> {
  await ensureSchema(); // cold-start safe: creates tables on a fresh database
  await migrateRolesOnce();
  let owner = await db.user.findFirst({ where: { role: "owner" }, orderBy: { id: "asc" } });

  if (!owner) {
    try {
      const userCount = await db.user.count();
      if (userCount === 0) {
        owner = await onboardUser({
          name: DEFAULT_USER_NAME,
          mode: "demo",
          salaryAmount: 30000,
          salaryPayDay: 2,
          openingBalance: 12000,
        });
      }
    } catch (e) {
      console.warn("[getOwnerUser] auto-seed notice:", e);
    }
  }

  return owner;
}

export interface OnboardingInput {
  name: string;
  mode: "personal" | "demo";
  salaryAmount?: number | null;
  salaryPayDay?: number | null;
  openingBalance?: number;
}

/** Create the owner account (idempotent). Demo mode seeds synthetic history. */
export async function onboardUser(input: OnboardingInput): Promise<User> {
  const existing = await getOwnerUser();
  if (existing) return existing;

  const user = await db.user.create({
    data: {
      name: input.name,
      role: "owner",
      mode: input.mode,
      preferredLanguage: "en",
      salaryAmount: input.salaryAmount ?? null,
      salaryPayDay: input.salaryPayDay ?? null,
      openingBalance: Math.max(0, Math.min(10_000_000, Math.round(input.openingBalance ?? 0))),
    },
  });

  if (input.mode === "demo") {
    // Demo profile mirrors the documented demo customer: ৳30,000 salary
    // around day 2 (unless the user already provided their own numbers).
    await db.user.update({
      where: { id: user.id },
      data: {
        salaryAmount: input.salaryAmount ?? 30000,
        salaryPayDay: input.salaryPayDay ?? 2,
        salaryMerchant: "Employer Payroll",
        openingBalance: 12000,
      },
    });
    await seedDemoHistory(user);
    await ensureKnowledge();
    await audit(user.id, "onboarded", { mode: input.mode, name: input.name });
    return (await db.user.findUnique({ where: { id: user.id } }))!;
  }
  await ensureKnowledge();
  await audit(user.id, "onboarded", { mode: input.mode, name: input.name });
  return user;
}

/** Seed 6 months of synthetic wallet history + a starter goal (demo mode). */
async function seedDemoHistory(user: User): Promise<void> {
  const anchor = new Date();
  const txns = generateDemoTransactions(anchor, 42);
  await db.transaction.createMany({
    data: txns.map((t) => ({
      userId: user.id,
      timestamp: t.timestamp,
      amount: t.amount,
      currency: t.currency,
      direction: t.direction,
      category: t.category,
      subcategory: t.subcategory,
      merchant: t.merchant,
      channel: t.channel,
      source: t.source,
      classificationConfidence: t.classificationConfidence,
    })),
  });

  const target = new Date(anchor);
  target.setMonth(target.getMonth() + 6);
  await db.goal.create({
    data: {
      userId: user.id,
      name: "Emergency fund",
      targetAmount: 30000,
      targetDate: target,
      savedSoFar: 4500,
      monthlyCommitment: Math.ceil((30000 - 4500) / 6),
      status: "active",
    },
  });
}

/**
 * Delete ALL owner data (transactions, goals, insights, audit trail,
 * forecasts and the account itself) so the app returns to onboarding.
 * Persona users that power the /api/v1 reference surface are preserved.
 */
export async function resetAllData(): Promise<void> {
  const owners = await db.user.findMany({ where: { role: "owner" } });
  const ids = owners.map((u) => u.id);
  if (ids.length === 0) return;
  await db.transaction.deleteMany({ where: { userId: { in: ids } } });
  await db.goal.deleteMany({ where: { userId: { in: ids } } });
  await db.insight.deleteMany({ where: { userId: { in: ids } } });
  await db.auditEvent.deleteMany({ where: { userId: { in: ids } } });
  await db.forecastRecord.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  rolesMigrated = true; // no owner exists; onboarding will create the next one
}

/** Knowledge base is static shared content — created once, kept across resets. */
export async function ensureKnowledge(): Promise<void> {
  await ensureSchema(); // cold-start safe: creates tables on a fresh database
  const kbCount = await db.knowledgeDoc.count();
  if (kbCount === 0) {
    await db.knowledgeDoc.createMany({
      data: KNOWLEDGE_CORPUS.map((c) => ({
        sourceId: c.sourceId, title: c.title, topic: c.topic, chunkText: c.chunkText,
      })),
    });
  }
}

/* ---------------- queries ---------------- */

export async function getUserTransactions(userId: number): Promise<Txn[]> {
  const rows = await db.transaction.findMany({
    where: { userId },
    orderBy: { timestamp: "asc" },
  });
  return rows.map(toTxn);
}

export async function getActiveGoals(userId: number): Promise<GoalT[]> {
  const rows = await db.goal.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(goalToDomain);
}

export function goalToDomain(g: Goal): GoalT {
  return {
    id: g.id,
    name: g.name,
    targetAmount: g.targetAmount,
    targetDate: g.targetDate.toISOString(),
    savedSoFar: g.savedSoFar,
    monthlyCommitment: g.monthlyCommitment,
    status: g.status,
  };
}

export async function getInsights(userId: number) {
  return db.insight.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
  });
}

export async function insertInsights(userId: number, generated: {
  insightType: string; severity: string; title: string; body: string;
  evidence: { label: string; value: string }[]; options: string[];
}[], modelVersion: string) {
  for (const g of generated) {
    await db.insight.create({
      data: {
        userId,
        insightType: g.insightType,
        severity: g.severity,
        title: g.title,
        body: g.body,
        evidenceJson: JSON.stringify(g.evidence),
        optionsJson: JSON.stringify(g.options),
        modelVersion,
      },
    });
  }
}

/**
 * Drop persisted insights so the next read regenerates them from current
 * data. Called after every data mutation (add/edit/delete transaction,
 * salary change, goal change) — insights must never show stale numbers.
 */
export async function clearInsights(userId: number) {
  await db.insight.deleteMany({ where: { userId } });
}

export async function getKnowledgeChunks() {
  const rows = await db.knowledgeDoc.findMany({ orderBy: { id: "asc" } });
  return rows.map((r) => ({
    id: r.id, sourceId: r.sourceId, title: r.title, topic: r.topic, chunkText: r.chunkText,
  }));
}

export async function audit(userId: number, kind: string, payload: unknown) {
  try {
    await db.auditEvent.create({
      data: { userId, kind, payloadJson: JSON.stringify(payload) },
    });
  } catch {
    // audit must never break the request path
  }
}

export async function recordForecast(userId: number, data: {
  horizonDays: number; predictedInflow: number; predictedOutflow: number;
  shortfallProb: number; pressure: string; factors: string[]; modelVersion: string;
}) {
  try {
    await db.forecastRecord.create({
      data: {
        userId,
        forecastDate: new Date(),
        horizonDays: data.horizonDays,
        predictedInflow: data.predictedInflow,
        predictedOutflow: data.predictedOutflow,
        shortfallProb: data.shortfallProb,
        pressure: data.pressure,
        factorsJson: JSON.stringify(data.factors),
        modelVersion: data.modelVersion,
      },
    });
  } catch {
    // recording must never break the forecast path
  }
}

export type { Transaction, Insight, User };
