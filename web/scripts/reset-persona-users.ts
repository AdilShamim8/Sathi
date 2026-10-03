/**
 * One-off: remove persona users (and their data) so they re-seed cleanly
 * with the corrected generator. The main UI demo user is untouched.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const NAMES = ["Rina Begum", "Tariq Hasan", "Jamila Khatun", "Rafiq Ahmed", "Anik Rahman"];

async function main() {
  for (const name of NAMES) {
    const users = await db.user.findMany({ where: { name } });
    for (const u of users) {
      await db.transaction.deleteMany({ where: { userId: u.id } });
      await db.goal.deleteMany({ where: { userId: u.id } });
      await db.insight.deleteMany({ where: { userId: u.id } });
      await db.auditEvent.deleteMany({ where: { userId: u.id } });
      await db.forecastRecord.deleteMany({ where: { userId: u.id } });
      await db.user.delete({ where: { id: u.id } });
      console.log(`deleted persona user ${name} (#${u.id})`);
    }
  }
  const remaining = await db.user.findMany({ select: { id: true, name: true } });
  console.log("remaining users:", remaining.map((u) => u.name).join(", "));
}

main().finally(() => db.$disconnect());
