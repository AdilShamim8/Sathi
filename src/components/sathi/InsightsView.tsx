"use client";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, FlaskConical, ShieldCheck } from "lucide-react";
import { api, type InsightRow } from "./api";
import { SectionTitle, SeverityDot } from "./bits";
import type { EvidenceItem } from "@/lib/engine/domain";
import { fmtDate } from "./format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLang } from "./i18n";

export function InsightsView() {
  const { lang } = useLang();
  const { data: insights, isLoading } = useQuery({ queryKey: ["insights"], queryFn: api.insights });
  const refresh = useMutation({ mutationFn: api.refreshInsights });
  const { data: metrics } = useQuery({ queryKey: ["metrics"], queryFn: api.metrics });
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <SectionTitle
        en="Insights"
        bn="ইনসাইট"
        right={
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="press flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-leaf shadow-ios disabled:opacity-50"
          >
            <RefreshCw className={refresh.isPending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
            {refresh.isPending ? (lang === "bn" ? "হচ্ছে…" : "…") : (lang === "bn" ? "রিফ্রেশ" : "Refresh")}
          </button>
        }
      />

      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>}

      {insights?.length === 0 && !isLoading && (
        <button
          onClick={() => refresh.mutate()}
          className="press w-full rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground"
        >
          {lang === "bn" ? "এখনো ইনসাইট নেই — ট্যাপ করে বিশ্লেষণ করুন।" : "No insights yet — tap to analyse your transactions."}
        </button>
      )}

      <AnimatePresence initial={false}>
        {insights?.map((ins) => (
          <motion.button
            key={ins.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setOpen(open === ins.id ? null : ins.id)}
            className="press w-full rounded-2xl border border-border/80 bg-card p-4 text-left shadow-ios transition hover:border-ink/25"
          >
            <div className="flex gap-2.5">
              <SeverityDot severity={ins.severity} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{ins.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{ins.body}</p>
                {open === ins.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 rounded-xl bg-secondary/60 p-3"
                  >
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {lang === "bn" ? "কেন আমরা এটা ভাবি · প্রমাণ" : "Why we think this · evidence"}
                    </p>
                    {(JSON.parse(ins.evidenceJson) as EvidenceItem[]).map((e, i) => (
                      <div key={i} className="flex justify-between gap-3 py-0.5 text-[12px]">
                        <span className="text-muted-foreground">{e.label}</span>
                        <span className="nums text-right font-medium">{e.value}</span>
                      </div>
                    ))}
                    {(JSON.parse(ins.optionsJson) as string[]).length > 0 && (
                      <>
                        <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {lang === "bn" ? "বিকল্প" : "Options"}
                        </p>
                        <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                          {(JSON.parse(ins.optionsJson) as string[]).map((o, i) => <li key={i}>{o}</li>)}
                        </ul>
                      </>
                    )}
                  </motion.div>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {fmtDate(ins.generatedAt)} · model {ins.modelVersion}
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>

      {/* P0 — model health: ML validation vs rule baseline */}
      {metrics && (
        <ModelHealth />
      )}
    </div>
  );
}

function ModelHealth() {
  const { lang } = useLang();
  const { data: metrics } = useQuery({ queryKey: ["metrics"], queryFn: api.metrics });
  if (!metrics) return null;

  const rm = metrics.riskModel;
  const mlBetterBss = rm.brierSkillScoreVsRule > 0;
  const mlBetterPr = rm.ml.prAuc >= rm.ruleBaseline.prAuc;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios"
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <FlaskConical className="h-4 w-4 text-leafdark" />
        {lang === "bn" ? "মডেল মূল্যায়ন · ML বনাম সাধারণ নিয়ম" : "Model health · ML vs simple rule"}
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
        {lang === "bn"
          ? "শর্টফল-রিস্ক মডেল একটি সাধারণ নিয়মের সাথে তুলনা করা হয়েছে (ব্যালেন্স < গড় ৭-দিনের ব্যয় হলে ঝুঁকি)। ট্রেন/টেস্ট স্প্লিট ব্যবহারকারী অনুযায়ী — কোনো লিকেজ নেই।"
          : "The shortfall-risk model is compared against a simple rule (risk when balance < mean 7-day outflow). Train/test split is by user — no leakage."}
      </p>

      {/* metric grid */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Brier Score</p>
          <p className="nums mt-0.5 text-base font-bold">
            {rm.ml.brier.toFixed(4)}
          </p>
          <p className="nums text-[10px] text-muted-foreground">
            {lang === "bn" ? "নিয়ম" : "rule"}: {rm.ruleBaseline.brier.toFixed(4)} · {lang === "bn" ? "জলবায়ু" : "climo"}: {rm.climatology.brier.toFixed(4)}
          </p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Brier Skill Score</p>
          <p className={cn("nums mt-0.5 text-base font-bold", mlBetterBss ? "text-leafdark" : "text-tomato")}>
            {rm.brierSkillScoreVsRule > 0 ? "+" : ""}{(rm.brierSkillScoreVsRule * 100).toFixed(1)}%
          </p>
          <p className="nums text-[10px] text-muted-foreground">
            vs rule · {(rm.brierSkillScoreVsClimatology * 100).toFixed(1)}% vs climo
          </p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">PR-AUC</p>
          <p className={cn("nums mt-0.5 text-base font-bold", mlBetterPr ? "text-leafdark" : "text-tomato")}>
            {rm.ml.prAuc.toFixed(4)}
          </p>
          <p className="nums text-[10px] text-muted-foreground">{lang === "bn" ? "নিয়ম" : "rule"}: {rm.ruleBaseline.prAuc.toFixed(4)} · ROC-AUC {rm.ml.auc.toFixed(3)}</p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{lang === "bn" ? "প্রশিক্ষণ/পরীক্ষা" : "Train / Test"}</p>
          <p className="nums mt-0.5 text-base font-bold">
            {rm.trainedOn.users}/{rm.testedOn.users} {lang === "bn" ? "জন" : "users"}
          </p>
          <p className="nums text-[10px] text-muted-foreground">
            {rm.trainedOn.days}/{rm.testedOn.days} {lang === "bn" ? "দিন" : "days"} · {rm.testedOn.positives}+ {lang === "bn" ? "ইতিবাচক" : "positives"}
          </p>
        </div>
      </div>

      {/* reliability curve */}
      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {lang === "bn" ? "নির্ভরযোগ্যতা (ক্যালিব্রেশন)" : "Reliability (calibration)"}
        </p>
        <div className="relative h-32 rounded-xl bg-secondary/40 p-2">
          {/* diagonal reference */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            <line x1="0" y1="100" x2="100" y2="0" stroke="#DDD8CB" strokeWidth="1" strokeDasharray="3 3" />
            {rm.ml.reliability.filter((b) => b.n > 0).map((b, i) => {
              const x = b.meanPred * 100;
              const y = b.obsRate * 100;
              return (
                <g key={i}>
                  <line x1={x} y1={100} x2={x} y2={100 - y} stroke="#06D6A0" strokeWidth="0.8" opacity="0.5" />
                  <circle cx={x} cy={100 - y} r={Math.max(1.5, Math.min(4, Math.sqrt(b.n)))} fill="#04956F" />
                </g>
              );
            })}
          </svg>
          <span className="absolute bottom-1 right-2 text-[9px] text-muted-foreground">
            {lang === "bn" ? "পূর্বাভাসিত সম্ভাবনা →" : "predicted →"}
          </span>
          <span className="absolute left-1 top-1 text-[9px] text-muted-foreground">↑ {lang === "bn" ? "পর্যবেক্ষিত" : "observed"}</span>
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {lang === "bn"
            ? "বিন্দু রেখার কাছে থাকলে মডেল সু-ক্যালিব্রেটেড। বৃত্তের আকার = নমুনার সংখ্যা।"
            : "Points near the diagonal mean well-calibrated. Bubble size = sample count."}
        </p>
      </div>

      {/* verdict */}
      <div className={cn(
        "mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed",
        mlBetterBss && mlBetterPr ? "bg-leaf/10 text-leafdark" : "bg-saffron/10 text-[#9a6a1a]",
      )}>
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {mlBetterBss && mlBetterPr
          ? (lang === "bn"
              ? `ML মডেল সাধারণ নিয়মকে হারিয়েছে: Brier ${rm.ml.brier.toFixed(4)} বনাম ${rm.ruleBaseline.brier.toFixed(4)}, PR-AUC ${rm.ml.prAuc.toFixed(3)} বনাম ${rm.ruleBaseline.prAuc.toFixed(3)}।`
              : `The ML model beats the simple rule: Brier ${rm.ml.brier.toFixed(4)} vs ${rm.ruleBaseline.brier.toFixed(4)}, PR-AUC ${rm.ml.prAuc.toFixed(3)} vs ${rm.ruleBaseline.prAuc.toFixed(3)}.`)
          : (lang === "bn"
              ? "সতর্কতা: এই নমুনায় ML নিয়মের চেয়ে ভালো করেনি — উৎপাদনে আরও ডেটা দরকার।"
              : "Caution: on this sample the ML did not beat the rule — more data needed before production.")}
      </div>

      {/* other metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <p className="nums text-base font-bold">{metrics.nlParser.categoryAccuracy}%</p>
          <p className="text-[10px] leading-tight text-muted-foreground">NL {lang === "bn" ? "ক্যাটাগরি" : "category"} accuracy</p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <p className="nums text-base font-bold">৳{metrics.forecastBacktest.maeDailyOutflowBdt.toLocaleString()}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">{lang === "bn" ? "পূর্বাভাস MAE/দিন" : "forecast MAE /day"} (30d holdout)</p>
        </div>
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <p className="nums text-base font-bold">{metrics.personaSanity.differentiated ? "✓" : "✗"}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">{lang === "bn" ? "ব্যক্তিত্ব ন্যায্যতা" : "persona fairness sanity"}</p>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        {lang === "bn"
          ? `সব ডেটা সিন্থেটিক, সিড করা — ডকুমেন্টেড অনুমানসহ। মডেল ${rm.modelVersion}। যেকোনো ML আপগ্রেড এই হোল্ডআউটে বেসলাইনকে হারাতে হবে।`
          : `All data synthetic, seeded, with documented assumptions. Model ${rm.modelVersion}. Any ML upgrade must beat this baseline on the holdout. Saver persona risk ${(metrics.personaSanity.saverRisk * 100).toFixed(0)}% vs volatile ${(metrics.personaSanity.unstableRisk * 100).toFixed(0)}%.`}
      </p>
    </motion.section>
  );
}
