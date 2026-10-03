"use client";
/**
 * Financial Copilot chat. Conversation history persists in localStorage
 * (device-local, capped) so a refresh never loses context; individual turns
 * can be removed and the whole history cleared in one tap.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Send, BookOpen, Sparkles, AlertTriangle, Trash2, X } from "lucide-react";
import { api } from "./api";
import { SectionTitle } from "./bits";
import type { CopilotAnswer } from "@/lib/engine/domain";
import { cn } from "@/lib/utils";
import { useLang } from "./i18n";

const SUGGESTED = [
  "Where is my money going?",
  "Why do I run short before month-end?",
  "How much can I safely spend?",
  "Can I reach my savings goal?",
  "What if I save ৳1,500 more each month?",
  "আগামী সাত দিনে ঘাটতির ঝুঁকি কত?",
  "Show me my recurring expenses",
  "What should I review this month?",
];

const HISTORY_KEY = "sathi-copilot-history";
const HISTORY_CAP = 60; // keep localStorage lean; oldest turns drop off

interface Turn {
  question: string;
  answer: CopilotAnswer;
  at: string; // ISO timestamp — shown when history spans days
}

function loadHistory(): Turn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Turn[];
    return Array.isArray(parsed) ? parsed.slice(-HISTORY_CAP) : [];
  } catch {
    return [];
  }
}

function saveHistory(turns: Turn[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(turns.slice(-HISTORY_CAP)));
  } catch {
    // storage full/unavailable — persistence is best-effort, never fatal
  }
}

function AnswerCard({ a }: { a: CopilotAnswer }) {
  const [showEvidence, setShowEvidence] = useState(true);
  const { lang } = useLang();
  return (
    <div className="rounded-2xl rounded-tl-sm border border-border/80 bg-card p-4 shadow-ios">
      <div className="flex items-center gap-2">
        <Sparkles className={cn("h-3.5 w-3.5", a.llmEnhanced ? "text-leafdark" : "text-muted-foreground")} />
        <span className="text-[11px] font-medium text-muted-foreground">
          {a.llmEnhanced
            ? (lang === "bn" ? "এআই-ভিত্তিক উত্তর (যাচাইকৃত)" : "AI-grounded answer (validated)")
            : (lang === "bn" ? "নির্ধারিত উত্তর (এআই অনুপলব্ধ)" : "Deterministic answer (AI unavailable)")}
        </span>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-balance">{a.summary}</p>

      {a.numbers.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {a.numbers.map((n, i) => (
            <div key={i} className="rounded-xl bg-secondary/70 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{n.label}</p>
              <p className="nums mt-0.5 text-[13px] font-semibold leading-snug">{n.value}</p>
            </div>
          ))}
        </div>
      )}

      {a.evidence.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowEvidence((v) => !v)}
            className="press text-[11px] font-semibold uppercase tracking-wide text-leafdark"
          >
            {showEvidence
              ? (lang === "bn" ? "প্রমাণ লুকান ▴" : "Hide evidence ▴")
              : (lang === "bn" ? "কেন? প্রমাণ দেখুন ▾" : "Why? Show evidence ▾")}
          </button>
          {showEvidence && (
            <ul className="mt-1.5 space-y-1">
              {a.evidence.map((e, i) => (
                <li key={i} className="flex justify-between gap-3 text-[12px]">
                  <span className="text-muted-foreground">{e.label}</span>
                  <span className="nums text-right font-medium">{e.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {a.options.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "আপনার বিকল্প — সিদ্ধান্ত আপনার" : "Your options — you decide"}
          </p>
          {a.options.map((o, i) => (
            <div key={i} className="rounded-xl border border-border/80 px-3 py-2">
              <p className="text-[13px] font-semibold">{o.title}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{o.description}</p>
              <p className="mt-1 text-[11px] font-medium text-leafdark">{o.impact}</p>
            </div>
          ))}
        </div>
      )}

      {a.assumptions.length > 0 && (
        <p className="mt-3 border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground">
          {lang === "bn" ? "অনুমান:" : "Assumptions:"} {a.assumptions.join(" · ")}
        </p>
      )}
      {a.knowledgeRefs.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground">
          <BookOpen className="mt-0.5 h-3 w-3 shrink-0" />
          {lang === "bn" ? "পটভূমি ধারণা:" : "Background concepts:"} {a.knowledgeRefs.join("; ")}
        </p>
      )}
      <p className="mt-2 flex items-start gap-1 text-[11px] italic text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-saffron" />
        {a.disclaimer}
      </p>
    </div>
  );
}

export function CopilotView() {
  const { lang } = useLang();
  // Safe lazy init: this view only mounts after the client-side boot gate
  // resolves, so localStorage is available and no SSR hydration can mismatch.
  const [turns, setTurns] = useState<Turn[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const ask = useMutation({ mutationFn: (question: string) => api.copilot(question) });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [turns.length]);

  const submit = async (q: string) => {
    if (!q.trim() || ask.isPending) return;
    setInput("");
    try {
      const answer = await ask.mutateAsync(q.trim());
      setTurns((t) => {
        const next = [...t, { question: q.trim(), answer, at: new Date().toISOString() }];
        saveHistory(next);
        return next;
      });
    } catch {
      // handled via ask.isError below
    }
  };

  const removeTurn = (index: number) => {
    setTurns((t) => {
      const next = t.filter((_, i) => i !== index);
      saveHistory(next);
      return next;
    });
  };

  const clearAll = () => {
    setTurns([]);
    saveHistory([]);
  };

  return (
    <div className="flex min-h-[calc(100dvh-13rem)] flex-col">
      <SectionTitle
        en="Financial Copilot"
        bn="আর্থিক কোপাইলট"
        right={
          turns.length > 0 ? (
            <button
              onClick={clearAll}
              className="press flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-tomato/40 hover:text-tomato"
              title={lang === "bn" ? "পুরো কথোপকথন মুছুন" : "Clear the whole conversation"}
            >
              <Trash2 className="h-3 w-3" />
              {lang === "bn" ? "মুছুন" : "Clear"}
            </button>
          ) : undefined
        }
      />

      {turns.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {lang === "bn"
              ? "বাংলা, বাংলিশ বা ইংরেজিতে জিজ্ঞেস করুন। উত্তর আপনার লেনদেন তথ্যে ভিত্তিক — প্রতিটি সংখ্যা হিসাব করা, কখনো বানানো নয়।"
              : "Ask about your money in Bangla, Banglish or English. Answers are grounded in your transaction data — every number is computed, never invented."}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => submit(q)}
                className="press rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-ink/40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex-1 space-y-4">
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div
              key={`${t.at}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="group space-y-2"
            >
              <div className="flex items-end justify-end gap-2">
                <button
                  onClick={() => removeTurn(i)}
                  className="press mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/40 transition hover:bg-tomato/10 hover:text-tomato"
                  aria-label={lang === "bn" ? "এই প্রশ্নটি মুছুন" : "Remove this exchange"}
                  title={lang === "bn" ? "মুছুন" : "Remove"}
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="ml-8 rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-background shadow-ios">
                  {t.question}
                </div>
              </div>
              <div className="mr-4">
                <AnswerCard a={t.answer} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {ask.isPending && (
          <div className="mr-4 rounded-2xl rounded-tl-sm border border-border/80 bg-card p-4 shadow-ios">
            <p className="animate-pulse text-sm text-muted-foreground">
              {lang === "bn"
                ? "লেনদেন পড়া হচ্ছে, হিসাব চলছে, জ্ঞানভান্ডার যাচাই হচ্ছে…"
                : "Reading your transactions, running the numbers, checking the knowledge base…"}
            </p>
          </div>
        )}
        {ask.isError && (
          <div className="rounded-2xl border border-tomato/30 bg-tomato/5 p-4 text-sm text-tomato">
            {lang === "bn"
              ? "কোপাইলট সাময়িকভাবে অনুপলব্ধ। উপরের ডেটা স্ক্রিনগুলো এখনো কাজ করছে — একটু পরে আবার চেষ্টা করুন।"
              : "The copilot is temporarily unavailable. Your data screens above still work — please try again in a moment."}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="sticky bottom-20 mt-4 flex items-center gap-2 rounded-2xl border border-border/80 bg-card p-2 shadow-ios-lg backdrop-blur">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(input)}
          placeholder={lang === "bn" ? "আপনার প্রশ্ন লিখুন…" : "Ask anything…"}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          aria-label="Question"
        />
        <button
          onClick={() => submit(input)}
          disabled={ask.isPending || !input.trim()}
          className="press rounded-xl bg-primary p-2.5 text-primary-foreground shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
