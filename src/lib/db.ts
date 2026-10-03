import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logging is a dev aid only — production must stay quiet and fast.
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db