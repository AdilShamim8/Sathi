import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from '@prisma/client'

/**
 * Resolve the SQLite location BEFORE the first PrismaClient is constructed.
 *
 * Why: serverless hosts (Vercel & co.) give each instance a fresh, read-only
 * filesystem except /tmp — and the repo default `file:../db/custom.db`
 * points outside the function bundle, while an unset DATABASE_URL makes the
 * PrismaClient constructor throw. Both cases 500 every API route on the
 * deployed site even though local dev works perfectly.
 *
 * Resolution rules:
 *   - local / self-hosted (no VERCEL env) → DATABASE_URL from .env /
 *     environment, exactly as before (default: the documented repo path).
 *   - Vercel + `file:` URL (or unset)     → redirected to an auto-created
 *     writable copy under /tmp. The data layer's `ensureSchema()` then
 *     builds the tables on that empty file — zero-config cold start.
 *   - remote provider URLs (libsql://, postgres://, mysql://…) are passed
 *     through untouched so a durable hosted database keeps working.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  const repoDefault = "file:../db/custom.db";

  // Local dev & self-hosted: unchanged behaviour, now with a sane default
  // so a missing .env no longer crashes with a cryptic Prisma error.
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return raw || repoDefault;
  }

  // Serverless: only remote providers bypass the /tmp redirect.
  if (raw && !raw.startsWith("file:")) return raw;

  const dir = path.join(os.tmpdir(), "sathi");
  const file = path.join(dir, "custom.db");
  fs.mkdirSync(dir, { recursive: true });
  // A zero-byte file is a valid empty SQLite database; ensureSchema()
  // (src/lib/server/ensureSchema.ts) creates the tables idempotently.
  if (!fs.existsSync(file)) fs.writeFileSync(file, "");
  return `file:${file}`;
}

process.env.DATABASE_URL = resolveDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Belt and suspenders: pass the resolved URL explicitly so the client
    // never depends on env-read timing inside the serverless runtime.
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Query logging is a dev aid only — production must stay quiet and fast.
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
