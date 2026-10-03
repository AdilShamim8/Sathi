import { PrismaClient } from '@prisma/client'

// Ensure a valid, writable SQLite path across environments
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Vercel serverless containers: only /tmp is writable
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes("/tmp")) {
    process.env.DATABASE_URL = "file:/tmp/sathi.db";
  }
} else if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:../db/custom.db";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Query logging is a dev aid only — production must stay quiet and fast.
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db