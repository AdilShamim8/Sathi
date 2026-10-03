/**
 * Verify the Turso/libSQL adapter path works with prisma-client-js 6.x:
 *   @libsql/client createClient -> @prisma/adapter-libsql -> PrismaClient({ adapter })
 * Exercises ensureSchema-style DDL + create/find queries on a local file DB.
 */
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

const DB = "/tmp/sathi-adapter-test.db";
try { fs.rmSync(DB); fs.rmSync(DB + "-journal"); } catch {}

// 6.x adapter signature: constructor(config: { url, authToken? })
const adapter = new PrismaLibSQL({ url: `file:${DB}` });
const prisma = new PrismaClient({ adapter });

const DDL = [
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
  `CREATE TABLE IF NOT EXISTS "KnowledgeDoc" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL
  )`,
];

async function main() {
  for (const stmt of DDL) await prisma.$executeRawUnsafe(stmt);
  const u = await prisma.user.create({ data: { name: "Adapter Test", role: "owner" } });
  console.log("created user:", u.id, u.name);
  const found = await prisma.user.findFirst({ where: { role: "owner" } });
  console.log("found user:", found?.id, found?.name);
  const count = await prisma.user.count();
  console.log("count:", count);
  await prisma.knowledgeDoc.createMany({
    data: [{ sourceId: "kb-01", title: "t", topic: "x", chunkText: "body" }],
  });
  console.log("knowledge count:", await prisma.knowledgeDoc.count());
  if (found?.name !== "Adapter Test" || count !== 1) throw new Error("QUERY MISMATCH");
  console.log("ADAPTER PATH OK");
}

main()
  .catch((e) => { console.error("ADAPTER PATH FAILED:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
