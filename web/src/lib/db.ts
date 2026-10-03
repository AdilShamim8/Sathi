import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
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
 *   - DURABLE HOSTED SQLITE (recommended for production): set
 *       DATABASE_URL      = libsql://…  (Turso / any libSQL server)
 *       DATABASE_AUTH_TOKEN = <token>
 *     The client is then built on the libSQL driver adapter, so every
 *     serverless instance talks to the SAME database — data survives cold
 *     starts, and routes can never disagree about state.
 *   - local / self-hosted (no VERCEL env) → DATABASE_URL from .env /
 *     environment, exactly as before (default: the documented repo path).
 *   - Vercel + `file:` URL (or unset)     → redirected to an auto-created
 *     writable copy under /tmp. ensureSchema() then builds the tables on
 *     that empty file — zero-config cold start, but the data is EPHEMERAL
 *     (per-instance, lost on recycle). Fine for a demo; not for real users.
 */
function resolveDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  const repoDefault = "file:../db/custom.db";

  // Hosted libSQL (Turso & co.) — handled by the driver adapter below.
  if (/^libsql:\/\//.test(raw) || /^https:\/\//.test(raw)) return raw;

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

const resolvedUrl = resolveDatabaseUrl();

function createDb(): PrismaClient {
  if (/^libsql:\/\//.test(resolvedUrl) || /^https:\/\//.test(resolvedUrl)) {
    // Durable hosted SQLite via the libSQL driver adapter (Turso-compatible).
    // Constructor takes the libSQL config directly (Prisma 6.x signature).
    return new PrismaClient({
      adapter: new PrismaLibSQL({
        url: resolvedUrl,
        authToken: process.env.DATABASE_AUTH_TOKEN ?? undefined,
      }),
    });
  }
  return new PrismaClient({
    // Belt and suspenders: pass the resolved URL explicitly so the client
    // never depends on env-read timing inside the serverless runtime.
    datasources: {
      db: {
        url: resolvedUrl,
      },
    },
  });
}

process.env.DATABASE_URL = resolvedUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
