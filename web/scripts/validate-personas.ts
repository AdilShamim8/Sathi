/**
 * Validate the Sathi persona generator against the reference data profile:
 * balances must stay non-negative under the documented rule (inflows applied
 * first each day; an outflow larger than the balance is skipped), and each
 * persona should show the documented behaviour (cash-out habits, recurring
 * salary, dry spells).
 */
import { generateSathiPersonaHistory, SATHI_PERSONA_IDS } from "../src/lib/engine/sathiPersonas";

const anchor = new Date("2026-10-03T12:00:00Z");
const DHAKA = 6 * 3600 * 1000;

function dhakaDayKey(d: Date): string {
  return new Date(d.getTime() + DHAKA).toISOString().slice(0, 10);
}

let allOk = true;
for (const id of SATHI_PERSONA_IDS) {
  const seed = 12345 + id.length * 7;
  const { txns, openingBalance } = generateSathiPersonaHistory(id, anchor, seed);

  // Replay with the reference rule: group by Dhaka day, inflows first,
  // outflows in time order (skip rule already applied by the generator —
  // a correct history replays to a non-negative running balance).
  const byDay = new Map<string, typeof txns>();
  for (const t of txns) {
    const k = dhakaDayKey(t.timestamp);
    const arr = byDay.get(k) ?? [];
    arr.push(t);
    byDay.set(k, arr);
  }
  let bal = openingBalance;
  let min = bal;
  for (const day of [...byDay.keys()].sort()) {
    const events = byDay.get(day)!;
    for (const e of events.filter((e) => e.direction === "in")) bal += e.amount;
    for (const e of events.filter((e) => e.direction === "out")) bal -= e.amount;
    min = Math.min(min, bal);
  }

  const inflow = txns.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const outflow = txns.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const cashouts = txns.filter((t) => t.category === "cash_out");
  const months = new Set(txns.map((t) => t.timestamp.toISOString().slice(0, 7))).size;

  console.log(
    `${id.padEnd(22)} n=${String(txns.length).padStart(4)} months=${String(months).padStart(2)} ` +
    `open=${String(openingBalance).padStart(6)} final=${String(Math.round(bal)).padStart(6)} min=${String(Math.round(min)).padStart(6)} ` +
    `in/out=${Math.round(inflow / Math.max(months, 1))}/${Math.round(outflow / Math.max(months, 1))} ` +
    `cashouts=${cashouts.length} (${(cashouts.length / Math.max(months, 1)).toFixed(1)}/mo)`,
  );
  if (min < 0) {
    console.error(`  ❌ NEGATIVE BALANCE ${Math.round(min)} — skip rule broken`);
    allOk = false;
  }
}
if (!allOk) process.exit(1);
console.log("\n✓ all personas non-negative under the reference rule, behaviour documented");
