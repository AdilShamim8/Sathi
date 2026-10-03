"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { api, type GoalPatchInput } from "./api";
import { Money, SectionTitle, KV } from "./bits";
import { ALL_CATEGORIES, type Goal } from "@/lib/engine/domain";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtDate } from "./format";
import { useLang } from "./i18n";
import { toast } from "@/hooks/use-toast";

const feasibilityStyle = {
  on_track: { label: "On track", bn: "লক্ষ্যে আছেন", cls: "bg-leaf/15 text-leafdark border-leaf/40" },
  tight: { label: "Tight", bn: "টানাটানি", cls: "bg-saffron/15 text-[#9a6a1a] border-saffron/40" },
  needs_adjustment: { label: "Needs adjustment", bn: "সমন্বয় দরকার", cls: "bg-tomato/15 text-tomato border-tomato/40" },
} as const;

function CreateGoalForm({ onCreated }: { onCreated: () => void }) {
  const { lang } = useLang();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("30000");
  const [months, setMonths] = useState("6");
  const create = useMutation({
    mutationFn: () => {
      const amt = parseInt(amount, 10);
      const m = parseInt(months, 10);
      return api.createGoal({ name: name.trim(), targetAmount: amt, months: m });
    },
    onSuccess: () => {
      toast({ title: lang === "bn" ? "লক্ষ্য তৈরি হয়েছে" : "Goal created" });
      onCreated();
    },
    onError: (e: Error) => toast({ title: "Could not create goal", description: e.message, variant: "destructive" }),
  });

  return (
    <form
      className="space-y-3 rounded-2xl border border-border/80 bg-card p-4 shadow-ios"
      onSubmit={(e) => {
        e.preventDefault();
        const amt = parseInt(amount, 10);
        const m = parseInt(months, 10);
        if (name.trim().length >= 2 && amt > 0 && m > 0) create.mutate();
      }}
    >
      <p className="text-sm font-semibold">{lang === "bn" ? "নতুন লক্ষ্য" : "New goal"}</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={lang === "bn" ? "যেমন: জরুরি তহবিল" : "e.g. Emergency fund"}
        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
      />
      <div className="flex gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          placeholder="৳ target"
          className="nums w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
        />
        <input
          value={months}
          onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          placeholder={lang === "bn" ? "মাস" : "months"}
          className="nums w-28 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
        />
      </div>
      <button
        type="submit"
        disabled={create.isPending}
        className="press w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-ios disabled:opacity-40"
      >
        {create.isPending ? (lang === "bn" ? "তৈরি হচ্ছে…" : "Creating…") : (lang === "bn" ? "লক্ষ্য তৈরি করুন" : "Create goal")}
      </button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {lang === "bn"
          ? "একাধিক সক্রিয় লক্ষ্য রাখা যায় — নতুন লক্ষ্য আগেরটি মুছে দেয় না।"
          : "Multiple active goals are supported — creating one never removes another."}
      </p>
    </form>
  );
}

/** Edit sheet: rename, retarget, adjust timeline, update saved amount, delete or mark achieved. */
function GoalSheet({ goal, open, onOpenChange }: { goal: Goal; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { lang } = useLang();
  const qc = useQueryClient();
  const [name, setName] = useState(goal.name);
  const [amount, setAmount] = useState(String(goal.targetAmount));
  const [months, setMonths] = useState("");
  const [savedSoFar, setSavedSoFar] = useState(String(goal.savedSoFar));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["goals"] });
    await qc.invalidateQueries({ queryKey: ["summary"] });
    await qc.invalidateQueries({ queryKey: ["insights"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const patch: GoalPatchInput = {};
      if (name.trim() !== goal.name && name.trim().length >= 2) patch.name = name.trim();
      const amt = parseInt(amount, 10);
      if (Number.isFinite(amt) && amt > 0 && amt !== goal.targetAmount) patch.targetAmount = amt;
      const m = parseInt(months, 10);
      if (Number.isFinite(m) && m >= 1 && m <= 120) patch.months = m;
      const s = parseInt(savedSoFar, 10);
      if (Number.isFinite(s) && s >= 0 && s !== goal.savedSoFar) patch.savedSoFar = s;
      if (Object.keys(patch).length === 0) throw new Error(lang === "bn" ? "কোনো পরিবর্তন নেই" : "No changes to save");
      return api.updateGoal(goal.id, patch);
    },
    onSuccess: async () => {
      await refresh();
      toast({ title: lang === "bn" ? "লক্ষ্য হালনাগাদ ✓" : "Goal updated ✓" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const markAchieved = useMutation({
    mutationFn: () => api.updateGoal(goal.id, { status: "achieved" }),
    onSuccess: async () => {
      await refresh();
      toast({ title: lang === "bn" ? "অভিনন্দন! লক্ষ্য পূরণ 🎉" : "Congratulations — goal achieved 🎉" });
      onOpenChange(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteGoal(goal.id),
    onSuccess: async () => {
      await refresh();
      toast({ title: lang === "bn" ? "লক্ষ্য মুছে ফেলা হয়েছে" : "Goal deleted" });
      onOpenChange(false);
    },
  });

  if (!open) return null;

  const monthsLeft = Math.max(
    0,
    Math.round((new Date(goal.targetDate).getTime() - Date.now()) / (30.44 * 24 * 3600 * 1000) * 10) / 10,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="thin-scrollbar relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 pb-safe shadow-ios-lg sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h3 className="text-base font-semibold tracking-tight">
          {lang === "bn" ? "লক্ষ্য সম্পাদনা" : "Edit goal"}
        </h3>

        <div className="mt-4 space-y-3.5">
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-name">{lang === "bn" ? "নাম" : "Name"}</label>
            <input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 160))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
            />
          </div>
          <div className="flex gap-2">
            <div className="w-full">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-target">{lang === "bn" ? "লক্ষ্য (৳)" : "Target (৳)"}</label>
              <input
                id="goal-target"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
                inputMode="numeric"
                className="nums mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
              />
            </div>
            <div className="w-32">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-months">{lang === "bn" ? "মাস" : "Months"}</label>
              <input
                id="goal-months"
                value={months}
                onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                inputMode="numeric"
                placeholder={String(Math.max(1, Math.round(monthsLeft)))}
                className="nums mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="goal-saved">
              {lang === "bn" ? "এ পর্যন্ত সঞ্চিত (৳)" : "Saved so far (৳)"}
            </label>
            <input
              id="goal-saved"
              value={savedSoFar}
              onChange={(e) => setSavedSoFar(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
              inputMode="numeric"
              className="nums mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {lang === "bn" ? "টাকা জমালে এখানে হালনাগাদ করুন" : "Update this as you set money aside"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={() => onOpenChange(false)} className="press flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-muted-foreground">
            {lang === "bn" ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="press flex-[2] rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-ios disabled:opacity-40"
          >
            {save.isPending ? (lang === "bn" ? "সংরক্ষণ হচ্ছে…" : "Saving…") : (lang === "bn" ? "সংরক্ষণ করুন" : "Save changes")}
          </button>
        </div>

        <div className="mt-3 space-y-1 border-t border-dashed border-border pt-3">
          <button
            onClick={() => markAchieved.mutate()}
            disabled={markAchieved.isPending}
            className="press flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-leafdark transition hover:bg-leaf/10"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {lang === "bn" ? "লক্ষ্য পূরণ হিসেবে চিহ্নিত করুন" : "Mark as achieved"}
          </button>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="press flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-tomato transition hover:bg-tomato/5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {lang === "bn" ? "লক্ষ্যটি মুছুন" : "Delete this goal"}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-1">
              <p className="flex-1 text-[12px] leading-snug text-muted-foreground">
                {lang === "bn" ? "নিশ্চিত? এটি ফেরানো যাবে না।" : "Are you sure? This cannot be undone."}
              </p>
              <button onClick={() => setConfirmDelete(false)} className="press rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground">
                {lang === "bn" ? "না" : "No"}
              </button>
              <button onClick={() => remove.mutate()} disabled={remove.isPending} className="press rounded-lg bg-tomato px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
                {remove.isPending ? "…" : (lang === "bn" ? "মুছুন" : "Delete")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { lang } = useLang();
  const [editOpen, setEditOpen] = useState(false);
  const { data: g, isLoading } = useQuery({
    queryKey: ["goalAnalysis", goal.id],
    queryFn: () => api.goalAnalysis(goal.id),
  });
  const [extra, setExtra] = useState(1500);
  const [cutCategory, setCutCategory] = useState("food_beverage");
  const [cutPct, setCutPct] = useState(10);
  const sim = useMutation({
    mutationFn: () => api.simulateGoal({ goalId: goal.id, extraMonthlySavings: extra, cutCategory, cutPct }),
  });

  if (isLoading || !g) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const fs = feasibilityStyle[g.feasibility];

  return (
    <div className="space-y-4">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-base font-semibold">{g.name}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", fs.cls)}>
              {lang === "bn" ? fs.bn : fs.label}
            </span>
            <button
              onClick={() => setEditOpen(true)}
              className="press flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-ink/40 hover:text-ink"
              aria-label={lang === "bn" ? "লক্ষ্য সম্পাদনা" : "Edit goal"}
              title={lang === "bn" ? "সম্পাদনা / মুছুন" : "Edit / delete"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {lang === "bn" ? "লক্ষ্য" : "Target"} <Money value={g.targetAmount} className="font-semibold text-ink" />
            </span>
            <span className="nums text-muted-foreground">{g.progressPct}% {lang === "bn" ? "সঞ্চিত" : "saved"}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${g.progressPct}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-leaf"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {lang === "bn" ? "লক্ষ্যের তারিখ" : "Target date"}: {fmtDate(g.targetDate)} · {g.monthsRemaining} {lang === "bn" ? "মাস বাকি" : "months left"}
          </p>
        </div>
        <div className="mt-3 divide-y divide-border/70 border-t border-border/70">
          <KV k={lang === "bn" ? "মাসে প্রয়োজন" : "Required per month"} v={<Money value={g.requiredMonthly} />} />
          <KV k={lang === "bn" ? "আপনার সম্ভাব্য সক্ষমতা" : "Your estimated capacity"} v={<Money value={g.currentCapacity} />} />
          <KV
            k={lang === "bn" ? "প্রক্ষেপিত ঘাটতি" : "Projected gap"}
            v={<Money value={g.projectedGap} className={g.projectedGap > 0 ? "text-tomato" : "text-leafdark"} />}
          />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{g.capacityBasis}.</p>
      </motion.section>

      {/* scenarios — options, not commands */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="mb-1 text-sm font-semibold">{lang === "bn" ? "আপনার বিকল্প" : "Your options"}</p>
        <p className="mb-3 text-[11px] text-muted-foreground">
          {lang === "bn" ? "পরিকল্পনা, নির্দেশ নয় — সিদ্ধান্ত আপনার।" : "Scenarios, not instructions — you decide."}
        </p>
        <div className="space-y-2.5">
          {g.scenarios.map((s) => (
            <div key={s.id} className={cn("rounded-xl border p-3", s.reachesGoal ? "border-leaf/40 bg-leaf/5" : "border-border bg-secondary/40")}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{s.title}</p>
                <span className={cn("nums shrink-0 text-xs font-bold", s.reachesGoal ? "text-leafdark" : "text-tomato")}>
                  {s.reachesGoal ? (lang === "bn" ? "লক্ষ্য পূরণ ✓" : "reaches goal ✓") : `gap ৳${s.gap.toLocaleString()}`}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{s.description}</p>
              <p className="nums mt-1 text-[12px] font-medium">
                <Money value={s.monthlyContribution} />/mo → <Money value={s.projectedTotal} /> {lang === "bn" ? "মাসে" : "in"} {s.months} {lang === "bn" ? "মাসে" : "months"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* simulation */}
      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="mb-3 text-sm font-semibold">{lang === "bn" ? "কী হলে কী হয়" : "What-if simulation"}</p>

        <label className="text-xs font-medium text-muted-foreground">
          {lang === "bn" ? "মাসে অতিরিক্ত সঞ্চয়:" : "Save extra per month:"} <Money value={extra} className="font-semibold text-ink" />
        </label>
        <input
          type="range" min={0} max={5000} step={100} value={extra}
          onChange={(e) => setExtra(parseInt(e.target.value, 10))}
          className="mt-1 w-full"
          aria-label="Extra monthly savings"
        />

        <div className="mt-3 flex items-center gap-2">
          <select
            value={cutCategory}
            onChange={(e) => setCutCategory(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-input bg-background px-2.5 py-2 text-sm"
            aria-label="Category to cut"
          >
            {ALL_CATEGORIES.filter((c) => c.discretionary).map((c) => (
              <option key={c.id} value={c.id}>{c.labelEn}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">{lang === "bn" ? "কমান" : "cut"}</span>
          <select
            value={cutPct}
            onChange={(e) => setCutPct(parseInt(e.target.value, 10))}
            className="nums w-20 rounded-xl border border-input bg-background px-2.5 py-2 text-sm"
            aria-label="Cut percentage"
          >
            {[5, 10, 15, 20, 30].map((p) => <option key={p} value={p}>{p}%</option>)}
          </select>
        </div>

        <button
          disabled={sim.isPending}
          onClick={() => sim.mutate()}
          className="press mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-semibold text-leaf shadow-ios transition hover:opacity-90 disabled:opacity-40"
        >
          {sim.isPending ? (lang === "bn" ? "সিমুলেট হচ্ছে…" : "Simulating…") : (lang === "bn" ? "সিমুলেশন চালান" : "Run simulation")}
        </button>

        {sim.data && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-xl bg-secondary/60 p-3"
          >
            <KV k={lang === "bn" ? "মাসে মুক্ত হবে" : "Freed per month"} v={<Money value={sim.data.freedMonthly} />} />
            <KV k={lang === "bn" ? "নতুন সক্ষমতা" : "New capacity"} v={<Money value={sim.data.newCapacity} />} />
            <KV k={lang === "bn" ? "লক্ষ্যের দিনে প্রক্ষেপণ" : "Projected at target date"} v={<Money value={sim.data.projectedTotal} />} />
            <KV
              k={lang === "bn" ? "বাকি ঘাটতি" : "Remaining gap"}
              v={<Money value={sim.data.projectedGap} className={sim.data.projectedGap > 0 ? "text-tomato" : "text-leafdark"} />}
            />
            {sim.data.monthsSaved !== null && sim.data.monthsSaved > 0 && (
              <KV k={lang === "bn" ? "আগে পৌঁছাবেন" : "Reaches goal sooner by"} v={`${sim.data.monthsSaved} ${lang === "bn" ? "মাস" : "month(s)"}`} />
            )}
            {sim.data.tradeoffs.length > 0 && (
              <div className="mt-2 border-t border-dashed border-border pt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {lang === "bn" ? "ট্রেড-অফ" : "Trade-offs"}
                </p>
                <ul className="list-disc space-y-1 pl-4 text-[12px] text-muted-foreground">
                  {sim.data.tradeoffs.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </section>

      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-ios">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {lang === "bn" ? "অনুমানসমূহ" : "Assumptions"}
        </p>
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-muted-foreground">
          {g.assumptions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      </section>

      <GoalSheet goal={goal} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

export function GoalsView() {
  const { lang } = useLang();
  const qc = useQueryClient();
  const { data: goals, isLoading } = useQuery({ queryKey: ["goals"], queryFn: api.goals });
  const [showForm, setShowForm] = useState(false);
  const activeGoals = (goals ?? []).filter((g) => g.status === "active");

  return (
    <div className="space-y-4">
      <SectionTitle
        en="Goals"
        bn="সঞ্চয়ের লক্ষ্য"
        right={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="press rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-leaf shadow-ios"
          >
            {showForm ? (lang === "bn" ? "বন্ধ" : "Close") : "+ New"}
          </button>
        }
      />
      {showForm && (
        <CreateGoalForm onCreated={async () => {
          setShowForm(false);
          await qc.invalidateQueries({ queryKey: ["goals"] });
          await qc.invalidateQueries({ queryKey: ["summary"] });
        }} />
      )}
      {isLoading && <Skeleton className="h-64 w-full rounded-2xl" />}
      <div className="space-y-8">
        {activeGoals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
      </div>
      {!isLoading && activeGoals.length === 0 && !showForm && (
        <p className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
          {lang === "bn"
            ? "কোনো সক্রিয় লক্ষ্য নেই। চেষ্টা করুন: “I want to save ৳30,000 in 6 months.”"
            : "No active goal. Try: “I want to save ৳30,000 in 6 months.”"}
        </p>
      )}
    </div>
  );
}
