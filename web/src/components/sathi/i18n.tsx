"use client";
/**
 * Tiny bilingual (EN/BN) dictionary. Default English; Bangla toggle in header.
 * Category labels come from the API in both languages; this covers UI chrome.
 */
import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "en" | "bn";

const dict = {
  home: { en: "Home", bn: "হোম" },
  spending: { en: "Spending", bn: "খরচ" },
  cashflow: { en: "Cash Flow", bn: "ক্যাশ ফ্লো" },
  goals: { en: "Goals", bn: "লক্ষ্য" },
  copilot: { en: "Copilot", bn: "কোপাইলট" },
  insights: { en: "Insights", bn: "ইনসাইট" },
  transactions: { en: "Transactions", bn: "লেনদেন" },
  moneyIn: { en: "Money in", bn: "আয়" },
  moneyOut: { en: "Money out", bn: "ব্যয়" },
  estSavings: { en: "Est. savings", bn: "সম্ভাব্য সঞ্চয়" },
  last30days: { en: "Last 30 days", bn: "শেষ ৩০ দিন" },
  outlook: { en: "Cash-flow outlook", bn: "ক্যাশ-ফ্লো পূর্বাভাস" },
  goalProgress: { en: "Goal progress", bn: "লক্ষ্যের অগ্রগতি" },
  aiInsight: { en: "AI Insight", bn: "এআই ইনসাইট" },
  addExpense: { en: "Add expense", bn: "খরচ যোগ করুন" },
  askCopilot: { en: "Ask the copilot", bn: "কোপাইলটকে জিজ্ঞেস করুন" },
  estimateNote: { en: "Estimate based on your history", bn: "আপনার ইতিহাসের ভিত্তিতে অনুমান" },
  notAdvice: {
    en: "Decision support, not financial advice. You decide.",
    bn: "এটি সিদ্ধান্ত-সহায়তা, আর্থিক পরামর্শ নয়। সিদ্ধান্ত আপনার।",
  },
  safeToSpend: { en: "Safe to spend", bn: "নিরাপদ ব্যয়" },
  next7days: { en: "next 7 days", bn: "আগামী ৭ দিন" },
  shortfallRisk: { en: "Shortfall risk", bn: "ঘাটতির ঝুঁকি" },
  dailyBudget: { en: "a day", bn: "প্রতিদিন" },
  salary: { en: "Salary", bn: "বেতন" },
  salarySettings: { en: "Salary settings", bn: "বেতন সেটিংস" },
  settings: { en: "Settings", bn: "সেটিংস" },
} as const;

export type DictKey = keyof typeof dict;

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "en",
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  // read persisted language lazily on first client render (no effect needed)
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const saved = localStorage.getItem("sathi-lang");
    return saved === "bn" || saved === "en" ? saved : "en";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem("sathi-lang", l);
    setLangState(l);
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function useT() {
  const { lang } = useLang();
  return (key: DictKey) => dict[key][lang];
}
