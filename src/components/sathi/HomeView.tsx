"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquarePlus, Sparkles, ShieldCheck, TrendingDown } from "lucide-react";
import { api } from "./api";
import { Money, PressureBadge, SectionTitle, Delta, SeverityDot, RiskBadge, StatusPill } from "./bits";
import { useLang, useT } from "./i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ViewKey } from "./AppShell";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

export function HomeView({ setView, onAddExpense, onOpenSalary }: { setView: (v: ViewKey) => void; onAddExpense: () => void; onOpenSalary: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["summary"],
    queryFn: api.summary,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-7 w-44" />
        </div>
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-2xl border border-tomato/30 bg-tomato/5 p-4 text-sm">
        Could not load your financial summary. {error?.message}
      </div>
    );
  }

  const sts = data.safeToSpend;
  const riskPct = Math.round(data.shortfallRisk * 100);

  return (
    <div className="space-y-6">
      {/* greeting */}
      <motion.div {...fadeUp}>
        <p className="text-sm text-muted-foreground">{lang === "bn" ? "আসসালামু আলাইকুম" : "Hello"},</p>
        <h1 className="text-2xl font-bold tracking-tight">{data.user.name}</h1>
      </motion.div>

      {/* P0 HERO — safe-to-spend + shortfall risk */}
      <motion.section
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl bg-ink p-5 text-background shadow-ios-lg"
      >
        {/* ambient glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-leaf/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-leaf/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("safeToSpend")} · {t("next7days")}
            </p>
            <StatusPill status={sts.status} labelEn={sts.statusLabelEn} labelBn={sts.statusLabelBn} />
          </div>

          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold text-background/70">৳</span>
            <motion.span
              key={sts.safeToSpendTotal}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="nums text-[44px] font-bold leading-none tracking-tight"
            >
              {sts.safeToSpendTotal.toLocaleString("en-IN")}
            </motion.span>
          </div>

          <p className="mt-1.5 text-[13px] text-background/70">
            ≈ <Money value={sts.dailySafeBudget} className="font-semibold text-background" /> {t("dailyBudget")}
            {" · "}
            {lang === "bn" ? "নগদ" : "cash on hand"} <Money value={sts.walletBalance} className="text-background" />
          </p>

          {/* shortfall risk row */}
          <button
            onClick={() => setView("cashflow")}
            className="press mt-4 flex w-full items-center justify-between rounded-2xl bg-background/10 px-3.5 py-3 text-left backdrop-blur-sm transition hover:bg-background/15"
          >
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                riskPct >= 60 ? "bg-tomato/20 text-tomato" : riskPct >= 30 ? "bg-saffron/20 text-[#e8a13a]" : "bg-leaf/20 text-leaf",
              )}>
                <TrendingDown className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-background/60">{t("shortfallRisk")} · {t("next7days")}</p>
                <p className="nums text-[15px] font-bold">
                  {riskPct}% {lang === "bn" ? "সম্ভাবনা" : "chance"}
                </p>
              </div>
            </div>
            {/* mini gauge */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-background/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${riskPct}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className={cn("h-full rounded-full", riskPct >= 60 ? "bg-tomato" : riskPct >= 30 ? "bg-saffron" : "bg-leaf")}
                />
              </div>
              <ArrowRight className="h-4 w-4 text-background/60" />
            </div>
          </button>

          <p className="mt-2.5 text-[11px] leading-relaxed text-background/50">
            {lang === "bn" ? sts.adviceBn : sts.adviceEn}
          </p>
        </div>
      </motion.section>

      {/* financial snapshot */}
      <motion.section
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.1 }}
        className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios"
        aria-label="Financial health"
      >
        <SectionTitle
          en={lang === "bn" ? "আর্থিক অবস্থা" : "Financial Health"}
          bn={lang === "bn" ? "Financial Health" : "আর্থিক অবস্থা"}
          right={<span className="text-[11px] text-muted-foreground">{t("last30days")}</span>}
        />
        <div className="grid grid-cols-3 divide-x divide-border/80">
          <div className="pr-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("moneyIn")}</p>
            <p className="mt-1 text-lg font-bold"><Money value={data.month.inflow} /></p>
          </div>
          <div className="px-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("moneyOut")}</p>
            <p className="mt-1 text-lg font-bold"><Money value={data.month.outflow} /></p>
          </div>
          <div className="pl-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("estSavings")}</p>
            <p className={cn("mt-1 text-lg font-bold", data.month.estSavings >= 0 ? "text-leafdark" : "text-tomato")}>
              <Money value={data.month.estSavings} />
            </p>
            {data.savingsChangePct !== null && (
              <div className="mt-0.5"><Delta value={data.savingsChangePct} /></div>
            )}
          </div>
        </div>
        <p className="mt-3 border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
          {t("estimateNote")} · {t("notAdvice")}
        </p>
      </motion.section>

      {/* outlook + goal */}
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.15 }}
        className="grid grid-cols-2 gap-3"
      >
        <button onClick={() => setView("cashflow")} className="press rounded-2xl border border-border/80 bg-card p-4 text-left shadow-ios transition hover:border-ink/25">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("outlook")}</p>
          <div className="mt-2"><PressureBadge level={data.cashflowPressure} /></div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            {t("next7days")} <ArrowRight className="h-3 w-3" />
          </p>
        </button>
        <button onClick={() => setView("goals")} className="press rounded-2xl border border-border/80 bg-card p-4 text-left shadow-ios transition hover:border-ink/25">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("goalProgress")}</p>
          {data.goalProgress ? (
            <>
              <p className="nums mt-1 text-lg font-bold">{data.goalProgress.pct}%</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${data.goalProgress.pct}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-leaf"
                />
              </div>
              <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{data.goalProgress.name}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No active goal yet</p>
          )}
        </button>
      </motion.div>

      {/* salary quick card */}
      <motion.button
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.18 }}
        onClick={onOpenSalary}
        className="press flex w-full items-center justify-between rounded-2xl border border-leaf/30 bg-leaf/5 px-4 py-3 text-left shadow-ios transition hover:border-leaf/50"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-leaf/15 text-base">💰</span>
          <div>
            <p className="text-sm font-semibold">
              {t("salary")} {data.user.salaryAmount ? <Money value={data.user.salaryAmount} className="text-leafdark" /> : null}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {data.user.salaryPayDay
                ? `${lang === "bn" ? "প্রতি মাসের" : "paid around day"} ${data.user.salaryPayDay} · ${lang === "bn" ? "সেটিংস বদলান" : "tap to adjust"}`
                : lang === "bn" ? "বেতন সেট করুন — ক্যাশ-ফ্লো আরও নির্ভুল হবে" : "Set your salary for sharper forecasting"}
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </motion.button>

      {/* top AI insight */}
      {data.topInsight && (
        <motion.button
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.21 }}
          onClick={() => setView("insights")}
          className="press block w-full rounded-2xl border border-ink/10 bg-ink p-4 text-left text-background shadow-ios-lg transition hover:bg-ink/95"
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-leaf">
            <Sparkles className="h-3.5 w-3.5" /> {t("aiInsight")}
          </div>
          <div className="mt-2 flex gap-2.5">
            <SeverityDot severity={data.topInsight.severity} />
            <div>
              <p className="font-semibold leading-snug text-balance">{data.topInsight.title}</p>
              <p className="mt-1 line-clamp-3 text-sm text-background/70">{data.topInsight.body}</p>
            </div>
          </div>
        </motion.button>
      )}

      {/* quick actions */}
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.24 }}
        className="grid grid-cols-2 gap-3"
      >
        <button
          onClick={onAddExpense}
          className="press flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-ios transition hover:opacity-90"
        >
          <MessageSquarePlus className="h-4 w-4" /> {t("addExpense")}
        </button>
        <button
          onClick={() => setView("copilot")}
          className="press flex items-center justify-center gap-2 rounded-2xl border border-ink/15 bg-card px-4 py-3.5 text-sm font-semibold shadow-ios transition hover:border-ink/40"
        >
          <Sparkles className="h-4 w-4" /> {t("askCopilot")}
        </button>
      </motion.div>

      <motion.p
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.27 }}
        className="text-center text-[11px] leading-relaxed text-muted-foreground"
      >
        {data.user.mode === "demo" ? (
          <>
            Demo mode · synthetic data · reset anytime from Settings
            <br />
            {lang === "bn"
              ? "সব সংখ্যা নির্ধারিত ইঞ্জিন থেকে — এআই কখনো হিসাব করে না"
              : "Every number comes from deterministic engines — never from the LLM"}
          </>
        ) : (
          <>
            {lang === "bn"
              ? "সব ডেটা এই ডিভাইসে · সব সংখ্যা নির্ধারিত ইঞ্জিন থেকে — এআই কখনো হিসাব করে না"
              : "All data stays on this device · every number comes from deterministic engines — never from the LLM"}
          </>
        )}
      </motion.p>
    </div>
  );
}
