"use client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Repeat, AlertCircle, Wallet2, CalendarClock } from "lucide-react";
import { api } from "./api";
import { Money, SectionTitle, KV } from "./bits";
import { categoryLabel } from "@/lib/engine/domain";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLang } from "./i18n";

export function SpendingView() {
  const { lang } = useLang();
  const { data, isLoading } = useQuery({ queryKey: ["spending"], queryFn: api.spending });

  if (isLoading || !data) {
    return <div className="space-y-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}</div>;
  }

  const maxCat = Math.max(...data.categories.map((c) => c.thisMonth), 1);

  return (
    <div className="space-y-6">
      <SectionTitle
        en={lang === "bn" ? "খরচের বুদ্ধিমত্তা" : "Spending Intelligence"}
        bn={lang === "bn" ? "Spending Intelligence" : "খরচের বুদ্ধিমত্তা"}
        right={<span className="text-[11px] text-muted-foreground">{lang === "bn" ? "শেষ ৩০ দিন" : "last 30 days"}</span>}
      />

      {/* totals */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <div className="grid grid-cols-3 divide-x divide-border/80">
          <div className="pr-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{lang === "bn" ? "মোট ব্যয়" : "Total out"}</p>
            <Money value={data.totalOut} className="mt-1 text-lg font-bold" />
          </div>
          <div className="px-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{lang === "bn" ? "আগের মাসে" : "Prev 30d"}</p>
            <Money value={data.lastMonthOut} className="mt-1 text-lg font-bold text-muted-foreground" />
          </div>
          <div className="pl-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{lang === "bn" ? "দৈনিক প্রয়োজনীয়" : "Daily essentials"}</p>
            <Money value={data.dailyEssentials} className="mt-1 text-lg font-bold text-leafdark" />
          </div>
        </div>
      </section>

      {/* categories */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="mb-3 text-sm font-semibold">
          {lang === "bn" ? "ক্যাটাগরি অনুযায়ী" : "By category"} · {lang === "bn" ? "মাস ভেদে" : "MoM trend"}
        </p>
        <div className="space-y-3">
          {data.categories.map((c, i) => (
            <motion.div
              key={c.category}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">{categoryLabel(c.category, lang)}</p>
                <div className="flex shrink-0 items-baseline gap-2">
                  <Money value={c.thisMonth} className="text-sm font-semibold" />
                  {c.changePct !== null && (
                    <span className={cn(
                      "nums rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      c.changePct > 10 ? "bg-tomato/10 text-tomato" : c.changePct < -10 ? "bg-leaf/10 text-leafdark" : "bg-secondary text-muted-foreground",
                    )}>
                      {c.changePct > 0 ? "+" : ""}{Math.round(c.changePct)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary/70">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(c.thisMonth / maxCat) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-leafdark/80"
                />
              </div>
              <p className="nums mt-0.5 text-[11px] text-muted-foreground">
                {Math.round(c.share)}% {lang === "bn" ? "ব্যয়ের" : "of outflow"} · {c.txCount}× · avg <Money value={c.avgAmount} />
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* recurring patterns — detected from history */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Repeat className="h-4 w-4 text-leafdark" />
          {lang === "bn" ? "পুনরাবৃত্ত প্যাটার্ন" : "Recurring patterns"}
        </p>
        <p className="mb-3 text-[11px] text-muted-foreground">
          {lang === "bn"
            ? "৯০ দিনের লেনদেন ইতিহাস থেকে শনাক্ত — কনফিগ থেকে নয়"
            : "Detected from your 90-day transaction history — never from config"}
        </p>

        {data.recurringIncome.length > 0 && (
          <div className="mb-3 rounded-xl bg-leaf/10 p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-leafdark">
              {lang === "bn" ? "পুনরাবৃত্ত আয়" : "Recurring income"}
            </p>
            {data.recurringIncome.map((r) => (
              <div key={r.key} className="flex items-baseline justify-between gap-3 py-0.5">
                <span className="truncate text-[13px] font-medium">
                  {r.merchant ?? r.label}
                  {r.typicalDayOfMonth ? <span className="text-muted-foreground"> · day {r.typicalDayOfMonth}</span> : null}
                </span>
                <span className="nums shrink-0 text-[12px] font-semibold text-leafdark">
                  ~<Money value={r.monthlyEstimate} />/mo
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {data.recurring.map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  {r.merchant ?? categoryLabel(r.category, lang)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.occurrences}× · {r.cadence} · avg <Money value={r.avgAmount} />
                </p>
              </div>
              <span className="nums shrink-0 text-[12px] font-semibold">~<Money value={r.monthlyEstimate} />/mo</span>
            </div>
          ))}
          {data.recurring.length === 0 && (
            <p className="text-[12px] text-muted-foreground">
              {lang === "bn" ? "এখনো কোনো পুনরাবৃত্ত প্যাটার্ন পাওয়া যায়নি।" : "No recurring patterns detected yet."}
            </p>
          )}
        </div>
      </section>

      {/* month-end pattern */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-saffron" />
          {lang === "bn" ? "মাসের শেষের ধরন" : "Month-end pattern"}
        </p>
        <div className="mt-2 divide-y divide-border/70">
          <KV k={lang === "bn" ? "দিন ২১–৩১ ব্যয় (মাসিক)" : "Outflow days 21–31 (per month)"} v={<Money value={Math.round(data.monthEndPattern.lateOutflow / 3)} />} />
          <KV k={lang === "bn" ? "দিন ২১–৩১ আয়" : "Inflow days 21–31"} v={<Money value={Math.round(data.monthEndPattern.lateInflow / 3)} />} />
          <KV k={lang === "bn" ? "ওই সময়ের অংশ" : "Share in that window"} v={`${Math.round(data.monthEndPattern.lateShare)}%`} />
        </div>
        {data.monthEndPattern.drySpell && (
          <p className="mt-2 rounded-lg bg-saffron/15 px-2.5 py-1.5 text-[11px] leading-relaxed text-[#9a6a1a]">
            {lang === "bn"
              ? "বেতনের আগে শুকনো সময় পুনরাবৃত্ত হয় — ব্যয় চলে কিন্তু আয় আসে না।"
              : "A repeating dry spell before payday: spending continues while no income arrives."}
          </p>
        )}
      </section>

      {/* cash-out */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Wallet2 className="h-4 w-4 text-ink" />
          {lang === "bn" ? "ক্যাশ-আউট আচরণ" : "Cash-out behaviour"}
        </p>
        <div className="mt-2 divide-y divide-border/70">
          <KV k={lang === "bn" ? "ক্যাশ-আউট (৩০ দিন)" : "Cash-outs (30d)"} v={`${data.cashOut.count}×`} />
          <KV k={lang === "bn" ? "মোট" : "Total"} v={<Money value={data.cashOut.total} />} />
          <KV k={lang === "bn" ? "ব্যয়ের অংশ" : "Share of outflow"} v={`${Math.round(data.cashOut.shareOfOutflow)}%`} />
        </div>
      </section>

      {/* anomalies */}
      {data.anomalies.length > 0 && (
        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="h-4 w-4 text-focusblue" />
            {lang === "bn" ? "অস্বাভাবিক লেনদেন" : "Unusual transactions"}
          </p>
          <p className="mb-2 text-[11px] text-muted-foreground">
            {lang === "bn" ? "প্রমাণসহ চিহ্নিত — রায় নয়।" : "Flagged with evidence, not judgement."}
          </p>
          <div className="space-y-2">
            {data.anomalies.map((a) => (
              <div key={a.id} className="rounded-xl bg-secondary/50 px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-medium">{a.merchant ?? categoryLabel(a.category, lang)}</p>
                  <span className="nums text-[12px] font-semibold"><Money value={a.amount} /></span>
                </div>
                <p className="text-[11px] text-muted-foreground">{a.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
