/** Smoke test: full forecaster chain on generated persona history. */
import {
  generateSathiPersonaHistory, SATHI_PERSONAS,
} from "../src/lib/engine/sathiPersonas";
import { forecastTransactions, getForecaster, stableSeed } from "../src/lib/engine/forecaster";
import { festivalWindow } from "../src/lib/engine/panel";
import { CALENDAR, THRESHOLDS } from "../src/lib/engine/sathiConfig";
import { takaToPaisa } from "../src/lib/engine/money";
import type { Txn } from "../src/lib/engine/domain";
import { dayIso } from "../src/lib/engine/timeutils";

const fc = getForecaster();
if (!fc) {
  console.error("FAIL: forecaster did not load");
  process.exit(1);
}
console.log("model version:", fc.version, "| boosters:", fc.boosters.size);

const anchor = new Date();
const t0 = Date.now();
for (const personaId of Object.keys(SATHI_PERSONAS)) {
  const spec = SATHI_PERSONAS[personaId]!;
  const { txns, openingBalance } = generateSathiPersonaHistory(
    personaId, anchor, stableSeed(personaId) % 100000,
  );
  const appTxns: Txn[] = txns.map((t) => ({
    id: 0,
    timestamp: t.timestamp.toISOString(),
    amount: t.amount,
    currency: "BDT",
    direction: t.direction,
    category: t.category,
    subcategory: t.subcategory,
    merchant: t.merchant,
    channel: t.channel,
    source: t.source,
    classificationConfidence: t.classificationConfidence,
  }));
  const origin = Math.floor(anchor.getTime() / 86400000);
  const f = forecastTransactions(
    fc, personaId, appTxns, openingBalance, origin, 21,
    {
      festivalDays: festivalWindow(CALENDAR.festival_days, CALENDAR.festival_lead_days),
      floorDays: 3,
      nPaths: 400,
      seed: stableSeed(44021, personaId),
      minHistoryDays: THRESHOLDS.min_history_days,
    },
  );
  const band = f.irregularQuantiles[6]!; // day 7
  console.log(
    `${personaId.padEnd(22)} txns=${String(txns.length).padStart(4)} ` +
    `p_shortfall=${f.pShortfall.toFixed(3)} trough=+${f.troughDay}d ` +
    `s2s=${(f.safeToSpendPaisa / 100).toFixed(0)}tk floor=${(f.floorPaisa / 100).toFixed(0)}tk ` +
    `window=${f.windowDays}d coh=${(f.cashOnHandPaisa / 100).toFixed(0)}tk conf=${f.confidence} ` +
    `q10/50/90(d7)=${band.map((v) => (v / 100).toFixed(0)).join("/")}`,
  );
}
console.log(`total ${((Date.now() - t0) / 1000).toFixed(2)}s`);
console.log("origin iso:", dayIso(Math.floor(anchor.getTime() / 86400000)), "essentials paisa:", takaToPaisa(350));
