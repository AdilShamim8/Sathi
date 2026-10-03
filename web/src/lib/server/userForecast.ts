/**
 * Persona user forecast — the app-side equivalent of the reference
 * api/services/forecast_service.py user_forecast(): loads the user's history
 * and runs the model forecaster at the as-of day with the config's
 * thresholds. Returns null when the model is unavailable or the user has no
 * transactions (callers fall back to the deterministic baselines).
 */

import type { User } from "@prisma/client";
import type { Txn } from "@/lib/engine/domain";
import {
  forecastTransactions, getForecaster, stableSeed, type UserForecast,
} from "@/lib/engine/forecaster";
import { festivalWindow } from "@/lib/engine/panel";
import { CALENDAR, SIMULATION_CONFIG, THRESHOLDS } from "@/lib/engine/sathiConfig";

export function personaUserForecast(user: User, txns: Txn[]): UserForecast | null {
  const fc = getForecaster();
  if (!fc || txns.length === 0) return null;
  try {
    // Forecast origin = today's ledger day (same UTC-day convention as the
    // persona generator and the panel adapter).
    const origin = Math.floor(Date.now() / 86400000);
    const userId = `u${user.id}`;
    return forecastTransactions(
      fc,
      userId,
      txns,
      user.openingBalance ?? 0,
      origin,
      THRESHOLDS.shortfall_horizon_days,
      {
        festivalDays: festivalWindow(CALENDAR.festival_days, CALENDAR.festival_lead_days),
        floorDays: THRESHOLDS.shortfall_floor_days,
        nPaths: SIMULATION_CONFIG.n_paths,
        seed: stableSeed(SIMULATION_CONFIG.seed, userId),
        minHistoryDays: THRESHOLDS.min_history_days,
      },
    );
  } catch (e) {
    console.warn("[userForecast] model forecast failed, falling back:", (e as Error).message);
    return null;
  }
}
