"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, ChevronDown, Zap } from "lucide-react";
import { api } from "./api";
import { Money, PressureBadge, SectionTitle, ConfidenceBadge, KV, RiskBadge } from "./bits";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLang } from "./i18n";

export function CashFlowView() {
  const { lang } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["forecast"],
    queryFn: () => api.forecast(7),
  });

  if (isLoading || !data) {
    return <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div>;
  }

  const { forecast: fc, risk, safeToSpend: sts, cashOnHand: cash, actions } = data;
  const maxDaily = Math.max(...fc.dailySeries.map((d) => Math.max(d.expectedOutflow, d.expectedInflow)), 1);
  const riskPct = Math.round(risk.probability * 100);

  return (
    <div className="space-y-6">
      <SectionTitle
        en={lang === "bn" ? "ক্যাশ-ফ্লো পূর্বাভাস" : "Cash-flow outlook"}
        bn={lang === "bn" ? "Cash-flow outlook" : "ক্যাশ-ফ্লো পূর্বাভাস"}
        right={<ConfidenceBadge level={fc.confidence} />}
      />

      {/* P0 hero — shortfall risk + expected flows */}
      <section className="overflow-hidden rounded-3xl bg-ink p-5 text-background shadow-ios-lg">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-background/60">
              {lang === "bn" ? "আগামী ৭ দিনে ঘাটতির ঝুঁকি" : "Shortfall risk · next 7 days"}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="nums text-[40px] font-bold leading-none tracking-tight">{riskPct}%</span>
              <RiskBadge probability={risk.probability} className="border-background/20 bg-background/10 text-background" />
            </div>
            {risk.troughDay && (
              <p className="mt-1 text-[12px] text-background/60">
                {lang === "bn" ? "সম্ভাব্য সর্বনিম্ন ব্যালেন্স" : "Projected lowest balance"}{" "}
                <Money value={risk.projectedTrough} className="font-semibold text-background" />
                {" · "}
                {new Date(risk.troughDay).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-background/60">{lang === "bn" ? "চাপ" : "Pressure"}</p>
            <PressureBadge level={fc.pressure} className="mt-1 border-background/20 bg-background/10 text-background" />
          </div>
        </div>

        {/* risk gauge */}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/15">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${riskPct}%` }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className={cn("h-full rounded-full", riskPct >= 60 ? "bg-tomato" : riskPct >= 30 ? "bg-saffron" : "bg-leaf")}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 divide-x divide-background/10">
          <div className="pr-4">
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-background/60">
              <ArrowDownRight className="h-3 w-3" /> {lang === "bn" ? "প্রত্যাশিত আয়" : "Expected inflow"}
            </p>
            <Money value={fc.expectedInflow} className="mt-0.5 text-xl font-bold text-leaf" />
          </div>
          <div className="pl-4">
            <p className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-background/60">
              <ArrowUpRight className="h-3 w-3" /> {lang === "bn" ? "প্রত্যাশিত ব্যয়" : "Expected outflow"}
            </p>
            <Money value={fc.expectedOutflow} className="mt-0.5 text-xl font-bold" />
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-background/10 px-3 py-2 text-[12px] text-background/70">
          {lang === "bn" ? "নিট অবস্থান" : "Net position"}: <Money value={fc.net} sign className="font-semibold text-background" /> ·{" "}
          {lang === "bn" ? "সম্ভাব্য পরিসর (৮০%)" : "likely range (80%)"} <Money value={fc.lowerBound} /> – <Money value={fc.upperBound} />
        </div>
        <p className="mt-2 text-[11px] text-background/50">
          {lang === "bn" ? "এটি অনুমান, নিশ্চয়তা নয়।" : "This is an estimate, not a certainty."} Model {fc.modelVersion} + {risk.modelVersion} · {fc.periodAnalyzed}.
        </p>
      </section>

      {/* safe-to-spend breakdown */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="text-sm font-semibold">
          {lang === "bn" ? "নিরাপদ ব্যয় — হিসাব" : "Safe-to-spend — the math"}
        </p>
        <div className="mt-2 divide-y divide-border/70">
          {sts.breakdown.map((b, i) => (
            <div key={i} className={cn("flex items-center justify-between py-2", b.label === "Safe to spend" && "border-t-2 border-ink/10 pt-2.5 font-semibold")}>
              <span className={cn("text-sm", b.label === "Safe to spend" ? "font-semibold text-ink" : "text-muted-foreground")}>
                {b.label === "Cash on hand" ? (lang === "bn" ? "নগদ তহবিল" : b.label)
                  : b.label === "Upcoming commitments (7d)" ? (lang === "bn" ? "আসন্ন দায়দেনা (৭ দিন)" : "Upcoming commitments (7d)")
                  : b.label === "Safety buffer" ? (lang === "bn" ? "সুরক্ষা বাফার" : "Safety buffer")
                  : b.label === "Prorated savings" ? (lang === "bn" ? "সঞ্চয়ের অংশ" : "Prorated savings")
                  : (lang === "bn" ? "নিরাপদ ব্যয়" : "Safe to spend")}
              </span>
              <Money value={b.amount} sign={b.amount < 0} className={cn("text-sm", b.label === "Safe to spend" ? "text-base font-bold text-leafdark" : "")} />
            </div>
          ))}
        </div>
        <p className="mt-2 border-t border-dashed border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {lang === "bn"
            ? `দৈনিক বাজেট ${`৳${sts.dailySafeBudget.toLocaleString()}`} · প্রতিশ্রুতিগুলো আপনার লেনদেন ইতিহাসের পুনরাবৃত্ত প্যাটার্ন থেকে শেখা হয়েছে।`
            : `Daily budget ৳${sts.dailySafeBudget.toLocaleString()} · commitments learned from recurring patterns in your history.`}
        </p>
      </section>

      {/* day-by-day bars */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="mb-3 text-sm font-semibold">{lang === "bn" ? "দিন ধরে দিন" : "Day by day"} · প্রতিদিন</p>
        <div className="flex items-end gap-1.5">
          {fc.dailySeries.map((d) => (
            <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                <div
                  className="w-2.5 rounded-t bg-leaf transition-all duration-500"
                  style={{ height: `${Math.max(2, (d.expectedInflow / maxDaily) * 100)}%` }}
                  title={`in ৳${d.expectedInflow}`}
                />
                <div
                  className="w-2.5 rounded-t bg-ink/70 transition-all duration-500"
                  style={{ height: `${Math.max(2, (d.expectedOutflow / maxDaily) * 100)}%` }}
                  title={`out ৳${d.expectedOutflow}`}
                />
              </div>
              <span className="text-[9px] text-muted-foreground">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-leaf" /> {lang === "bn" ? "আয়" : "inflow"}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ink/70" /> {lang === "bn" ? "ব্যয়" : "outflow"}</span>
        </div>
      </section>

      {/* WHY — explainability with evidence (P0) */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="mb-2 text-sm font-semibold">
          {lang === "bn" ? "কেন এই ঝুঁকি? — প্রমাণসহ" : "Why this risk level? — the evidence"}
        </p>
        <div className="mb-3 space-y-1.5">
          {risk.topFactors.map((f, i) => {
            const increases = f.contribution > 0;
            return (
              <div key={i} className="flex items-start gap-2.5 rounded-xl bg-secondary/50 px-3 py-2">
                <span className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                  increases ? "bg-tomato" : "bg-leafdark",
                )}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug">{f.label}</p>
                  <p className="nums text-[12px] text-muted-foreground">{f.value}</p>
                </div>
                <span className={cn(
                  "nums shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  increases ? "bg-tomato/10 text-tomato" : "bg-leaf/10 text-leafdark",
                )}>
                  {increases ? "↑" : "↓"} {Math.abs(f.contribution).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {lang === "bn" ? "চাপের কারণ" : "Pressure factors"}
        </p>
        <ol className="space-y-2">
          {fc.factors.map((f, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-background">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{f}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 border-t border-dashed border-border pt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "অনুমানসমূহ" : "Assumptions"}
          </p>
          <ul className="list-disc space-y-1 pl-4 text-[12px] text-muted-foreground">
            {fc.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      </section>

      {/* income timing (cash-on-hand) */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="mb-2 text-sm font-semibold">{lang === "bn" ? "আয়ের সময় ও নগদ" : "Income timing & cash on hand"}</p>
        <div className="divide-y divide-border/70">
          <KV k={lang === "bn" ? "ওয়ালেট ব্যালেন্স (আনুমানিক)" : "Wallet balance (est.)"} v={<Money value={cash.walletBalance} />} />
          <KV
            k={lang === "bn" ? "পরবর্তী বেতন-সদৃশ আয়" : "Next salary-like income"}
            v={cash.nextIncomeDate
              ? `${new Date(cash.nextIncomeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} (${cash.daysToNextIncome}d) · ~৳${cash.nextIncomeEstimate.toLocaleString()}`
              : "—"}
          />
          <KV
            k={lang === "bn" ? "শনাক্তকরণের উৎস" : "Detection source"}
            v={cash.salaryDetectedFromHistory
              ? (lang === "bn" ? "লেনদেন ইতিহাস (পুনরাবৃত্ত প্যাটার্ন)" : "Transaction history (recurring pattern)")
              : (lang === "bn" ? "ব্যবহারকারীর সেটিংস" : "User settings")}
          />
          <KV k={lang === "bn" ? "দৈনিক অত্যাবশ্যকীয় খরচ" : "Daily essentials"} v={<Money value={cash.dailyEssentials} />} />
          <KV k={lang === "bn" ? "মাসিক গড় আয় (৯০ দিন)" : "Avg monthly income (90d)"} v={<Money value={cash.avgMonthlyIncome} />} />
        </div>
      </section>

      {/* P1 — actions & simulation */}
      {actions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle
            en={lang === "bn" ? "করণীয় ও সিমুলেশন" : "Actions you could take"}
            bn={lang === "bn" ? "Actions you could take" : "করণীয় ও সিমুলেশন"}
          />
          {actions.map((a) => (
            <ActionCard key={a.id} action={a} />
          ))}
          <p className="text-center text-[11px] text-muted-foreground">
            {lang === "bn" ? "বিকল্প উপস্থাপিত হয়, নির্দেশ নয় — সিদ্ধান্ত আপনার।" : "Options are presented, never commanded — you decide."}
          </p>
        </section>
      )}
    </div>
  );
}

function ActionCard({ action }: { action: import("@/lib/engine/domain").ActionCard }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const sim = useMutation({
    mutationFn: () => api.simulateAction({ actionId: action.id }),
  });

  const s = sim.data;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-ios">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !sim.data) sim.mutate();
        }}
        className="press flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-leaf/15 text-leafdark">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-semibold leading-tight">{lang === "bn" ? action.titleBn : action.titleEn}</p>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{action.description}</p>
          {action.simulated && (
            <p className="nums mt-1.5 text-[11px] font-medium text-leafdark">
              ~৳{action.simulated.freedMonthly.toLocaleString()}/mo freed · risk {Math.round(action.simulated.shortfallProbBefore * 100)}% → {Math.round(action.simulated.shortfallProbAfter * 100)}%
            </p>
          )}
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="overflow-hidden border-t border-border/70 bg-secondary/30 px-4 py-3"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "কেন এটি প্রস্তাবিত" : "Why this is suggested"}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{action.rationale}</p>

          {sim.isPending && <p className="mt-2 animate-pulse text-[11px] text-muted-foreground">Simulating impact…</p>}

          {s && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-card p-2.5 text-center shadow-xs">
                <p className="nums text-sm font-bold text-tomato">
                  {Math.round(s.before.shortfallProb * 100)}% → {Math.round(s.after.shortfallProb * 100)}%
                </p>
                <p className="text-[9px] leading-tight text-muted-foreground">{lang === "bn" ? "ঝুঁকি" : "shortfall risk"}</p>
              </div>
              <div className="rounded-xl bg-card p-2.5 text-center shadow-xs">
                <p className="nums text-sm font-bold text-leafdark">
                  ৳{s.after.safeToSpend.toLocaleString()}
                </p>
                <p className="text-[9px] leading-tight text-muted-foreground">{lang === "bn" ? "নিরাপদ ব্যয়" : "safe to spend"}</p>
              </div>
              <div className="rounded-xl bg-card p-2.5 text-center shadow-xs">
                <p className="nums text-sm font-bold">
                  {s.goalImpact.monthsSaved !== null && s.goalImpact.monthsSaved > 0
                    ? `−${s.goalImpact.monthsSaved}mo`
                    : s.goalImpact.gapAfter !== null
                      ? `৳${s.goalImpact.gapAfter.toLocaleString()}`
                      : "—"}
                </p>
                <p className="text-[9px] leading-tight text-muted-foreground">
                  {s.goalImpact.monthsSaved !== null && s.goalImpact.monthsSaved > 0 ? (lang === "bn" ? "লক্ষ্যে দ্রুত" : "to goal sooner") : (lang === "bn" ? "লক্ষ্যের ঘাটতি" : "goal gap")}
                </p>
              </div>
            </div>
          )}

          <p className="mt-2.5 rounded-lg bg-saffron/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-[#9a6a1a]">
            <span className="font-semibold">{lang === "bn" ? "ট্রেড-অফ:" : "Trade-off:"}</span> {action.tradeoff}
          </p>
        </motion.div>
      )}
    </div>
  );
}
