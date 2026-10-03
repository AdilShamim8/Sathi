/**
 * Serverless / cold-start schema bootstrap.
 *
 * Local dev and self-hosted deploys run `bun run db:push` once and keep a
 * persistent `db/custom.db`. On serverless hosts (Vercel & co.) the filesystem
 * is fresh per cold start and `db push` never runs — so the first query would
 * fail with P2021 ("table does not exist").
 *
 * `ensureSchema()` runs the idempotent DDL below exactly once per process
 * (CREATE TABLE / INDEX IF NOT EXISTS, same shapes `prisma db push` produces).
 * It costs one fast no-op pass on warm starts and makes the app boot on any
 * empty SQLite file. Seed data (owner, personas, knowledge corpus) is handled
 * by the existing lazy seeders in data.ts / sathiApi.ts.
 *
 * NOTE for serverless: point DATABASE_URL at a writable path (e.g.
 * `file:/tmp/sathi.db`). Data then lives per-instance and resets on cold
 * starts — demo-grade. For persistent hosted data use Postgres (see README
 * §Deployment).
 */
import { db } from "@/lib/db";

/** Same DDL `prisma db push` writes, made idempotent. Order matters (User first). */
const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "role" TEXT NOT NULL DEFAULT 'persona',
    "mode" TEXT NOT NULL DEFAULT 'personal',
    "salaryAmount" INTEGER,
    "salaryPayDay" INTEGER,
    "salaryMerchant" TEXT,
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "direction" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "merchant" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'wallet',
    "source" TEXT NOT NULL DEFAULT 'synthetic',
    "classificationConfidence" REAL NOT NULL DEFAULT 1,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Goal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" INTEGER NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "savedSoFar" INTEGER NOT NULL DEFAULT 0,
    "monthlyCommitment" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Insight" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "insightType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "KnowledgeDoc" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ForecastRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "forecastDate" DATETIME NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "predictedInflow" INTEGER NOT NULL,
    "predictedOutflow" INTEGER NOT NULL,
    "shortfallProb" REAL NOT NULL,
    "pressure" TEXT NOT NULL,
    "factorsJson" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    CONSTRAINT "ForecastRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "UserInput" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL UNIQUE,
    "cashOnHandTaka" INTEGER,
    "cashOnHandUpdatedAt" DATETIME,
    "incomeDay" INTEGER,
    "rentAmountTaka" INTEGER,
    "rentConfirmed" BOOLEAN NOT NULL DEFAULT 0,
    "otherLiquidTaka" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserInput_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Transaction_userId_timestamp_idx" ON "Transaction"("userId", "timestamp")`,
  `CREATE INDEX IF NOT EXISTS "Goal_userId_status_idx" ON "Goal"("userId", "status")`,
  `CREATE INDEX IF NOT EXISTS "Insight_userId_generatedAt_idx" ON "Insight"("userId", "generatedAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "ForecastRecord_userId_forecastDate_idx" ON "ForecastRecord"("userId", "forecastDate")`,
];

let schemaReady: Promise<void> | null = null;

/** Run the idempotent DDL once per process. Safe to call on every request. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of DDL) {
        await db.$executeRawUnsafe(stmt);
      }
    })().catch((e) => {
      // Reset so a transient failure (e.g. cold /tmp) can retry on next call.
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}
