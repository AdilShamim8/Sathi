import { NextRequest } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, buildEvidence, ok, unauthorized, notFound,
} from "@/lib/server/sathiApi";
import { personaUserForecast } from "@/lib/server/userForecast";
import { THRESHOLDS, SIMULATION_CONFIG, bandRisk } from "@/lib/engine/sathiConfig";
import { simulateBalancePaths, shortfallStats, dailyQuantiles, percentile } from "@/lib/engine/simulation";
import { estimateCashOnHand } from "@/lib/engine/analytics";
import { formatTaka, formatProbability, formatDate } from "@/lib/engine/formatting";
import { addDays, dayIso, fromDay } from "@/lib/engine/timeutils";
import { MODEL_VERSION } from "@/lib/engine/domain";

export const dynamic = "force-dynamic";

/**
 * Cash-flow forecast (reference: GET /v1/me/forecast, ML handoff 7e4f6a0).
 *
 * Primary method: the irregular-flow LightGBM quantile forecaster + recurring
 * stream detection + calibrated path simulation â€” the same model version the
 * Python pipeline evaluated (docs/eval_report.md). Fallback (model artifacts
 * unavailable): the previous production method, the seeded stationary block
 * bootstrap of daily net-flow residuals. Both produce P(shortfall) before the
 * next income, the median trough day and daily p10/p50/p90 balance bands.
 */
export async function GET(req: NextRequest) {
  try {
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();
    const { txns } = await personaTxns(user.id);

    const anchor = new Date();
    const asOf = anchor.toISOString().slice(0, 10);
    const originDay = Math.floor(anchor.getTime() / 86400000);
    const horizon = THRESHOLDS.shortfall_horizon_days; // 21

    // ---- primary: model forecaster (fail-closed to bootstrap) ----
    const fc = personaUserForecast(user, txns);
    let startBalancePaisa: number;
    let pShortfall: number;
    let troughDay: number | null;
    let confidence: string;
    let daysToIncome: number | null;
    let nextIncomeDate: string | null;
    let method: string;
    let modelVersion: string;
    let dailyPoints: { date: string; p10_paisa: number; p10_display: string; p50_paisa: number; p50_display: string; p90_paisa: number; p90_display: string }[];

    if (fc) {
      startBalancePaisa = fc.paths[0]?.[0] ?? 0;
      pShortfall = fc.pShortfall;
      troughDay = fc.troughDay;
      confidence = fc.confidence;
      daysToIncome = fc.daysToIncome;
      nextIncomeDate =
        fc.daysToIncome >= 1 && fc.daysToIncome <= 90 ? dayIso(originDay + fc.daysToIncome) : null;
      method = "lightgbm-quantile + recurring streams + calibrated paths";
      modelVersion = fc.modelVersion;
      dailyPoints = [];
      for (let d = 1; d <= horizon; d++) {
        const col = fc.paths.map((p) => p[d]!);
        const q10 = Math.trunc(percentile(col, 10));
        const q50 = Math.trunc(percentile(col, 50));
        const q90 = Math.trunc(percentile(col, 90));
        dailyPoints.push({
          date: dayIso(originDay + d),
          p10_paisa: q10,
          p10_display: formatTaka(q10 / 100, "bn"),
          p50_paisa: q50,
          p50_display: formatTaka(q50 / 100, "bn"),
          p90_paisa: q90,
          p90_display: formatTaka(q90 / 100, "bn"),
        });
      }
    } else {
      // ---- fallback: seeded stationary block bootstrap ----
      const essentials = THRESHOLDS.essentials_per_day_paisa / 100; // taka
      const cash = estimateCashOnHand(txns, anchor, user.openingBalance, {
        amount: user.salaryAmount, payDay: user.salaryPayDay,
      });
      const startBalance = cash.walletBalance;
      const dailyNets = new Map<string, number>();
      for (const t of txns) {
        const key = t.timestamp.slice(0, 10);
        const amt = t.direction === "in" ? t.amount : -t.amount;
        dailyNets.set(key, (dailyNets.get(key) ?? 0) + amt);
      }
      const sortedDates = [...dailyNets.keys()].sort();
      const residuals = sortedDates.length
        ? sortedDates.map((d) => dailyNets.get(d)!)
        : [-essentials];
      const daySeed = parseInt(asOf.replace(/-/g, ""), 10);
      const paths = simulateBalancePaths({
        residuals,
        startBalance,
        horizonDays: horizon,
        blockLengthDays: SIMULATION_CONFIG.block_length_days,
        nPaths: SIMULATION_CONFIG.n_paths,
        seed: daySeed,
      });
      const daysToIncomeFallback = cash.daysToNextIncome ?? horizon;
      const stats = shortfallStats(paths, essentials, Math.min(daysToIncomeFallback, horizon));
      startBalancePaisa = startBalance * 100;
      pShortfall = stats.pShortfall;
      troughDay = stats.medianTroughDay;
      confidence = txns.length >= THRESHOLDS.min_history_transactions ? "normal" : "low";
      daysToIncome = cash.daysToNextIncome;
      nextIncomeDate = cash.nextIncomeDate ?? null;
      method = `seeded stationary block bootstrap (${SIMULATION_CONFIG.block_length_days}-day blocks, ${SIMULATION_CONFIG.n_paths} paths)`;
      modelVersion = `${MODEL_VERSION}+bootstrap-sim`;
      dailyPoints = dailyQuantiles(paths).map((q) => {
        const date = addDays(anchor, q.dayIndex);
        return {
          date: date.toISOString().slice(0, 10),
          p10_paisa: q.p10 * 100,
          p10_display: formatTaka(q.p10, "bn"),
          p50_paisa: q.p50 * 100,
          p50_display: formatTaka(q.p50, "bn"),
          p90_paisa: q.p90 * 100,
          p90_display: formatTaka(q.p90, "bn"),
        };
      });
    }

    const troughDateStr =
      troughDay !== null && troughDay > 0
        ? formatDate(fromDay(originDay + troughDay), "bn")
        : null;

    const riskLevel = bandRisk(pShortfall);

    const data = {
      horizon_days: horizon,
      as_of_date: asOf,
      start_balance_paisa: startBalancePaisa,
      start_balance_display: formatTaka(startBalancePaisa / 100, "bn"),
      shortfall_prob: pShortfall,
      shortfall_prob_display: formatProbability(pShortfall, "bn"),
      risk_level: riskLevel,
      days_to_next_income: daysToIncome,
      next_income_date: nextIncomeDate,
      trough_date: troughDateStr,
      confidence,
      method,
      model_version: modelVersion,
      days: dailyPoints,
    };

    const evidence = buildEvidence({
      nTransactions: txns.length,
      windowStart: txns.length ? txns[0].timestamp.slice(0, 10) : asOf,
      asOfDate: asOf,
      labels: {
        shortfall_prob: "Prediction",
        start_balance: "Data",
        trough_date: "Prediction",
        daily_quantiles: "Prediction",
      },
      forecastVersion: modelVersion,
      extraAssumptions: [
        { id: "SIM_N_PATHS", value: String(SIMULATION_CONFIG.n_paths), label: "Balance paths simulated" },
        { id: "SIM_BLOCK_DAYS", value: String(fc ? 7 : SIMULATION_CONFIG.block_length_days), label: "Block length preserving day correlation" },
        { id: "SHORTFALL_FLOOR_DAYS", value: String(THRESHOLDS.shortfall_floor_days), label: "Personal floor: days of own median daily outflow" },
      ],
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 forecast]", e);
    return notFound("Forecast failed");
  }
}

