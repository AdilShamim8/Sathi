"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, X, Pencil, Keyboard, Sparkles, ReceiptText } from "lucide-react";
import { api, type TxnRow } from "./api";
import { Money, SectionTitle } from "./bits";
import { categoryLabel, type ParsedExpense } from "@/lib/engine/domain";
import { dayLabel, fmtTime } from "./format";
import { useLang } from "./i18n";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { TxnSheet } from "./TxnSheet";

/** NL capture box: parse preview → confirm → save (human oversight loop). */
function NaturalLanguageCapture({ onSaved, onClose, onUseForm }: { onSaved: () => void; onClose: () => void; onUseForm: () => void }) {
  const [text, setText] = useState("");
  const qc = useQueryClient();
  const { lang } = useLang();

  const preview = useQuery({
    queryKey: ["parse", text],
    queryFn: () => api.parse(text),
    enabled: text.trim().length >= 3,
  });

  const save = useMutation({
    mutationFn: (confirmed: boolean) => api.addTransaction(text, confirmed),
    onSuccess: async (res) => {
      if (res.saved) {
        await qc.invalidateQueries({ queryKey: ["transactions"] });
        await qc.invalidateQueries({ queryKey: ["summary"] });
        await qc.invalidateQueries({ queryKey: ["insights"] });
        toast({ title: lang === "bn" ? "সংরক্ষিত ✓" : "Saved ✓", description: `৳${res.parsed.amount?.toLocaleString()} · ${categoryLabel(res.parsed.category)}` });
        onSaved();
      }
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const p: ParsedExpense | undefined = preview.data;
  const needsConfirm = p && p.confidence < 0.7;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-ink/10 bg-card p-4 shadow-ios">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            {lang === "bn" ? "স্বাভাষিকভাবে লিখুন" : "Say it naturally"}
            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
              {lang === "bn" ? "বাংলা / English" : "বাংলা / Banglish"}
            </span>
          </p>
          <button onClick={onClose} className="press rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="আজকে coffee খাইছি ২০০ টাকা"
            className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
            onKeyDown={(e) => {
              if (e.key === "Enter" && p?.amount) save.mutate(!needsConfirm);
            }}
          />
          <button
            className="press rounded-xl bg-secondary p-2.5 text-muted-foreground"
            title={lang === "bn" ? "ভয়েস ইনপুট (সম্ভব হলে)" : "Voice input (uses browser speech-to-text where available)"}
            aria-label="Voice input"
            onClick={() => {
              const w = window as unknown as { webkitSpeechRecognition?: new () => { lang: string; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; start: () => void } };
              if (w.webkitSpeechRecognition) {
                const rec = new w.webkitSpeechRecognition();
                rec.lang = "bn-BD";
                rec.onresult = (e) => setText(e.results[0][0].transcript);
                rec.start();
              } else {
                toast({ title: lang === "bn" ? "এই ব্রাউজারে ভয়েস সমর্থিত নয়" : "Voice input is not supported in this browser" });
              }
            }}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>

        {preview.isFetching && (
          <p className="mt-2 animate-pulse text-[11px] text-muted-foreground">Parsing…</p>
        )}

        {p && !preview.isFetching && (
          <div className="mt-3 rounded-xl bg-secondary/70 p-3 text-sm">
            {p.amount === null ? (
              <p className="text-tomato">{lang === "bn" ? "পরিমাণ পাওয়া যায়নি — যেমন: “coffee 200 taka”" : "I couldn't find an amount — try “coffee 200 taka”."}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <Money value={p.amount} className="text-lg font-bold" />
                  <span className="font-medium">{categoryLabel(p.category)} · {categoryLabel(p.category, "bn")}</span>
                  {p.subcategory && <span className="text-muted-foreground">({p.subcategory})</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                  <span>{p.language === "bn" ? "বাংলা" : p.language === "banglish" ? "Banglish" : "English"}</span>
                  <span>confidence {Math.round(p.confidence * 100)}%</span>
                  <span>{p.direction === "out" ? (lang === "bn" ? "খরচ" : "expense") : (lang === "bn" ? "আয়" : "income")}</span>
                </div>
                {p.notes.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{p.notes.join(" · ")}</p>
                )}
                {needsConfirm && (
                  <p className="mt-2 rounded-lg bg-saffron/15 px-2 py-1 text-[11px] text-[#9a6a1a]">
                    {lang === "bn" ? "নিশ্চিত করে সংরক্ষণ করুন — ক্যাটাগরি যাচাই করুন।" : "Low confidence — please check the category before saving."}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <button
          disabled={!p?.amount || save.isPending}
          onClick={() => save.mutate(true)}
          className="press mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          {save.isPending
            ? (lang === "bn" ? "সংরক্ষিত হচ্ছে…" : "Saving…")
            : needsConfirm
              ? (lang === "bn" ? "নিশ্চিত ও সংরক্ষণ" : "Confirm & save")
              : (lang === "bn" ? "সংরক্ষণ করুন" : "Save transaction")}
          {!save.isPending && <Send className="h-4 w-4" />}
        </button>

        <button
          onClick={onUseForm}
          className="press mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-medium text-muted-foreground transition hover:text-ink"
        >
          <Keyboard className="h-3.5 w-3.5" />
          {lang === "bn" ? "ফর্ম দিয়ে লিখুন (আয় ও নির্ভুল এন্ট্রির জন্য)" : "Use the form instead (for income & precise entries)"}
        </button>
      </div>
    </motion.div>
  );
}

export function TransactionsView({ autoCompose = false }: { autoCompose?: boolean }) {
  const [compose, setCompose] = useState(autoCompose);
  const [category, setCategory] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; editing: TxnRow | null }>({ open: false, editing: null });
  const { lang } = useLang();
  const { data: txns, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.transactions({ limit: 200 }),
  });

  const grouped = useMemo(() => {
    const g = new Map<string, TxnRow[]>();
    for (const t of txns ?? []) {
      const key = dayLabel(t.timestamp);
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(t);
    }
    return [...g.entries()];
  }, [txns]);

  const filtered = useMemo(() => {
    if (!category) return grouped;
    return grouped
      .map(([k, list]) => [k, list.filter((t) => t.category === category)] as const)
      .filter(([, list]) => list.length > 0);
  }, [grouped, category]);

  const usedCategories = useMemo(
    () => [...new Set((txns ?? []).map((t) => t.category))],
    [txns],
  );

  const openEdit = (t: TxnRow) => {
    setSheet({ open: true, editing: t });
  };

  const openCreate = () => {
    setSheet({ open: true, editing: null });
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        en="Transactions"
        bn="লেনদেন"
        right={
          <div className="flex gap-1.5">
            <button
              onClick={openCreate}
              className="press rounded-full bg-leaf px-3 py-1.5 text-xs font-semibold text-[#04382b] shadow-ios"
              title={lang === "bn" ? "ফর্ম দিয়ে যোগ করুন (আয়/খরচ)" : "Add via form (income/expense)"}
            >
              + <span className="hidden sm:inline">{lang === "bn" ? "ফর্ম" : "Form"}</span>
            </button>
            <button
              onClick={() => setCompose((v) => !v)}
              className="press rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-leaf shadow-ios"
            >
              {compose ? (lang === "bn" ? "বন্ধ" : "Close") : `+ ${lang === "bn" ? "লিখে" : "Type"}`}
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {compose && (
          <NaturalLanguageCapture
            onSaved={() => setCompose(false)}
            onClose={() => setCompose(false)}
            onUseForm={openCreate}
          />
        )}
      </AnimatePresence>

      {/* category filter chips */}
      {(txns ?? []).length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory(null)}
            className={cn("press shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition", !category ? "border-ink bg-ink text-background" : "border-border bg-card text-muted-foreground")}
          >
            {lang === "bn" ? "সব" : "All"}
          </button>
          {usedCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cn("press shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition", category === c ? "border-ink bg-ink text-background" : "border-border bg-card text-muted-foreground")}
            >
              {categoryLabel(c, lang)}
            </button>
          ))}
        </div>
      )}

      {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}

      {/* empty state */}
      {!isLoading && (txns ?? []).length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
            <ReceiptText className="h-5 w-5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-sm font-semibold">
            {lang === "bn" ? "এখনো কোনো লেনদেন নেই" : "No transactions yet"}
          </p>
          <p className="mx-auto mt-1 max-w-[26ch] text-[12px] leading-relaxed text-muted-foreground">
            {lang === "bn"
              ? "প্রথম আয় বা খরচ যোগ করুন — বাকিটা এমনিই হিসাব হবে"
              : "Add your first income or expense — everything else follows automatically"}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              onClick={openCreate}
              className="press rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-ios"
            >
              {lang === "bn" ? "ফর্ম দিয়ে যোগ করুন" : "Add via form"}
            </button>
            <button
              onClick={() => setCompose(true)}
              className="press rounded-xl border border-ink/15 bg-card px-4 py-2 text-xs font-semibold"
            >
              {lang === "bn" ? "লিখে যোগ করুন" : "Type it naturally"}
            </button>
          </div>
        </div>
      )}

      {filtered.map(([day, list]) => (
        <section key={day}>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{day}</p>
          <div className="thin-scrollbar divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-ios">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => openEdit(t)}
                className="press flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-secondary/40"
                title={lang === "bn" ? "সম্পাদনা করতে ট্যাপ করুন" : "Tap to edit"}
              >
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  t.direction === "in" ? "bg-leaf/15 text-leafdark" : "bg-secondary text-ink",
                )}>
                  {categoryLabel(t.category).slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.merchant ?? categoryLabel(t.category, lang)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {categoryLabel(t.category, lang)}
                    {t.subcategory ? ` · ${t.subcategory}` : ""} · {fmtTime(t.timestamp)}
                    {t.source === "natural_language_input" && " · NL"}
                    {t.source === "manual" && (lang === "bn" ? " · ম্যানুয়াল" : " · manual")}
                    {t.classificationConfidence < 1 && ` · ${Math.round(t.classificationConfidence * 100)}% conf`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Pencil className="h-3 w-3 text-muted-foreground/50" />
                  <Money
                    value={t.direction === "in" ? t.amount : -t.amount}
                    sign
                    className={cn("text-sm font-semibold", t.direction === "in" ? "text-leafdark" : "text-ink")}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {(txns ?? []).length > 0 && (
        <p className="flex items-center justify-center gap-1 pt-2 text-center text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          {lang === "bn"
            ? "যেকোনো লেনদেনে ট্যাপ করে সম্পাদনা বা মুছুন — ক্যাটাগরি নির্ধারিত নিয়মে"
            : "Tap any transaction to edit or delete — categories assigned by deterministic rules"}
        </p>
      )}

      {sheet.open && (
        <TxnSheet
          key={sheet.editing ? `edit-${sheet.editing.id}` : "create"}
          editing={sheet.editing}
          onClose={() => setSheet({ open: false, editing: null })}
        />
      )}
    </div>
  );
}
