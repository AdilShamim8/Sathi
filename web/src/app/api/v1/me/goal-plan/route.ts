import { NextRequest } from "next/server";
import {
  userIdFromRequest, ensurePersonaUser, personaTxns, buildEvidence, ok, unauthorized, notFound, badRequest,
} from "@/lib/server/sathiApi";
import { PLANNER_CONFIG, THRESHOLDS } from "@/lib/engine/sathiConfig";
import { planGoal } from "@/lib/engine/planner";
import { monthlyTotals } from "@/lib/engine/metricsEngine";
import { cashoutFee } from "@/lib/engine/cashout";
import { formatTaka, formatProbability } from "@/lib/engine/formatting";

export const dynamic = "force-dynamic";

/**
 * Monte Carlo goal plan (reference: POST /v1/me/goal-plan) â€” three honest
 * options (extend timeline / trim leakage / percent of inflow) with Wilson
 * 95% intervals, from the user's own surplus distribution.
 */
export async function POST(req: NextRequest) {
  try {
    const personaId = userIdFromRequest(req);
    if (!personaId) return unauthorized();
    const user = await ensurePersonaUser(personaId).catch(() => null);
    if (!user) return notFound();
    const { txns } = await personaTxns(user.id);

    const body = (await req.json().catch(() => null)) as
      | { goal_type?: string; target_paisa?: number; months?: number }
      | null;
    const targetPaisa = body?.target_paisa;
    const months = body?.months;
    if (!targetPaisa || targetPaisa <= 0) return badRequest("target_paisa must be positive");
    if (!months || months <= 0 || months > 36) return badRequest("months must be 1..36");

    const anchor = new Date();
    const target = Math.round(targetPaisa / 100); // taka
    const totals = [...monthlyTotals(txns).values()];

    // Surplus and inflow samples from the user's own history.
    let surplusSamples = totals.map((v) => v.inflow - v.outflow);
    let inflowSamples = totals.map((v) => v.inflow);
    const minContrib = THRESHOLDS.min_goal_monthly_contribution_paisa / 100;
    if (!surplusSamples.length) {
      surplusSamples = [minContrib * 2];
      inflowSamples = [minContrib * 5];
    }

    // Fee leakage per month (configured illustrative rate).
    const feeSum = txns
      .filter((t) => t.direction === "out" && t.category === "cash_out")
      .reduce((s, t) => s + cashoutFee(t.amount), 0);
    const monthlyFee = Math.round(feeSum / Math.max(totals.length, 1));
    const maxSafe = Math.max(
      Math.round(surplusSamples.reduce((s, v) => s + v, 0) / surplusSamples.length),
      minContrib,
    );

    const plan = planGoal({
      target,
      months,
      monthlySurplusSamples: surplusSamples,
      monthlyInflowSamples: inflowSamples,
      monthlyFeeLeakage: monthlyFee,
      monthlyAvoidable: Math.round(monthlyFee / 2),
      maxSafeContribution: maxSafe,
      config: {
        nSimulations: PLANNER_CONFIG.n_simulations,
        horizonCapMonths: PLANNER_CONFIG.horizon_cap_months,
        minMonthlyContribution: minContrib,
        likelyCutoff: PLANNER_CONFIG.likely_cutoff,
        uncertainCutoff: PLANNER_CONFIG.uncertain_cutoff,
      },
      seed: PLANNER_CONFIG.seed,
      asOfDate: anchor,
    });

    const titleBn: Record<string, string> = {
      extend_timeline: "à¦¸à¦®à¦¯à¦¼ à¦¬à¦¾à¦¡à¦¼à¦¿à¦¯à¦¼à§‡ à¦¸à¦¹à¦œà§‡ à¦¸à¦žà§à¦šà¦¯à¦¼",
      trim_leakage: "à¦…à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨à§€à¦¯à¦¼ à¦«à¦¿ à¦•à¦®à¦¿à¦¯à¦¼à§‡ à¦¸à¦žà§à¦šà¦¯à¦¼",
      percent_of_inflow: "à¦ªà§à¦°à¦¤à¦¿ à¦†à¦¯à¦¼à§‡à¦° à¦¨à¦¿à¦°à§à¦¦à¦¿à¦·à§à¦Ÿ à¦…à¦‚à¦¶ à¦¸à¦žà§à¦šà¦¯à¦¼",
    };
    const titleEn: Record<string, string> = {
      extend_timeline: "Extend Timeline",
      trim_leakage: "Redirect Avoidable Fees",
      percent_of_inflow: "Save Percentage of Inflows",
    };

    const data = {
      goal_type: body?.goal_type ?? "other",
      target_paisa: plan.target * 100,
      target_display: formatTaka(plan.target, "bn"),
      requested_months: plan.requestedMonths,
      monthly_required_paisa: plan.monthlyRequired * 100,
      monthly_required_display: formatTaka(plan.monthlyRequired, "bn"),
      p_requested: plan.pRequested,
      p_requested_display: formatProbability(plan.pRequested, "bn"),
      verdict: plan.verdict,
      feasibility_note_bn: plan.feasibilityNoteBn,
      feasibility_note_en: plan.feasibilityNoteEn,
      deadline: plan.deadline,
      options: plan.options.map((opt) => ({
        key: opt.key,
        title_bn: titleBn[opt.key] ?? opt.key,
        title_en: titleEn[opt.key] ?? opt.key,
        monthly_contribution_paisa: opt.monthlyContribution * 100,
        monthly_contribution_display: formatTaka(opt.monthlyContribution, "bn"),
        percent_of_inflow: opt.percentOfInflow,
        months: opt.months,
        p_goal_met: opt.pGoalMet,
        p_goal_met_display: formatProbability(opt.pGoalMet, "bn"),
        p_low: opt.pLow,
        p_high: opt.pHigh,
        tradeoff_bn: opt.tradeoffBn,
        tradeoff_en: opt.tradeoffEn,
      })),
    };

    const evidence = buildEvidence({
      nTransactions: txns.length,
      windowStart: txns.length ? txns[0].timestamp.slice(0, 10) : anchor.toISOString().slice(0, 10),
      asOfDate: anchor.toISOString().slice(0, 10),
      labels: { plan: "Prediction", options: "Prediction", p_goal_met: "Prediction" },
      extraAssumptions: [
        { id: "PLANNER_N_SIMS", value: String(PLANNER_CONFIG.n_simulations), label: "Monte Carlo paths per option" },
        { id: "MIN_BUFFER_DAYS", value: String(THRESHOLDS.min_buffer_days), label: "Planner never drops below this buffer" },
      ],
    });
    return ok(data, evidence);
  } catch (e) {
    console.error("[v1 goal-plan]", e);
    return notFound("Goal plan failed");
  }
}

