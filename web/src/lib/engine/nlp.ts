/**
 * Natural-language expense capture.
 * Deterministic parser for Bangla, English and Banglish — e.g.
 *   "আজকে coffee খাইছি ২০০ টাকা।"  →  200 BDT, food_beverage/coffee, today
 *   "spent 500 on groceries yesterday"
 *   "aj bazar korlam 850 taka"
 * Also parses SALARY entries ("বেতন পেয়েছি ৩০০০০ টাকা") as income.
 * Returns a confidence score; low-confidence parses are confirmed with the
 * user before saving (human oversight).
 */
import { CATEGORIES, OTHER_CATEGORY, type ParsedExpense } from "./domain";

const BN_DIGITS: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
  "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
};

export function normalizeBanglaDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => BN_DIGITS[d] ?? d);
}

const HAS_BANGLA = /[\u0980-\u09FF]/;

const TODAY_WORDS = ["আজ", "আজকে", "today", "aj", "ajke"];
const YESTERDAY_WORDS = ["কাল", "গতকাল", "yesterday", "kal", "gotokal"];

const INCOME_WORDS = ["পেয়েছি", "পেলাম", "জমা পড়েছে", "বেতন", "salary", "received", "got paid", "income", "cash in"];

/** spending verbs in Bangla/Banglish that signal an expense */
const EXPENSE_WORDS = ["খাইছি", "খেয়েছি", "খরচ", "করলাম", "করেছি", "কিনলাম", "কিনেছি", "দিলাম", "দিয়েছি", "তুললাম", "তুলেছি", "পাঠালাম", "পাঠিয়েছি", "korlam", "khoroch", "kinlam", "dilam", "spent", "paid", "bought"];

function detectLanguage(text: string): "bn" | "en" | "banglish" {
  const hasBn = HAS_BANGLA.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  if (hasBn && hasLatin) return "banglish";
  if (hasBn) return "bn";
  return "en";
}

function extractAmount(text: string): number | null {
  const normalized = normalizeBanglaDigits(text);
  const m =
    normalized.match(/৳\s*([\d,]+(?:\.\d+)?)/) ||
    normalized.match(/([\d,]+(?:\.\d+)?)\s*(?:টাকা|taka|tk|bdt)/i) ||
    normalized.match(/\b([\d,]+(?:\.\d+)?)\b/);
  if (!m) return null;
  const value = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) return null;
  return Math.round(value);
}

/**
 * Category classifier with two fixes over naive substring matching:
 *  1. Latin keywords match on word boundaries (tokens) — "recharge" must
 *     not trigger the food keyword "cha".
 *  2. Bangla keywords use substring matching (suffix-tolerant) —
 *     "আম্মুকে" must still match "আম্মু".
 * Generic buy-verbs were removed from keywords so specific nouns win.
 */
function tokenizeWords(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9\u0980-\u09FF]+/).filter(Boolean);
}

function isLatinKeyword(kw: string): boolean {
  return /^[a-zA-Z0-9 -]+$/.test(kw);
}

function keywordMatches(tokens: string[], lowerText: string, kw: string): boolean {
  if (isLatinKeyword(kw)) {
    const kwTokens = kw.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (kwTokens.length === 0) return false;
    for (let i = 0; i <= tokens.length - kwTokens.length; i++) {
      let ok = true;
      for (let j = 0; j < kwTokens.length; j++) {
        if (tokens[i + j] !== kwTokens[j]) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }
  return lowerText.includes(kw);
}

function classifyCategory(text: string): { category: string; subcategory: string | null; matched: string | null } {
  const lower = text.toLowerCase();
  const tokens = tokenizeWords(text);
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (keywordMatches(tokens, lower, kw)) {
        const sub = ["coffee", "কফি"].some((k) => lower.includes(k)) ? "coffee" : null;
        return { category: cat.id, subcategory: cat.id === "food_beverage" ? sub : null, matched: kw };
      }
    }
  }
  return { category: OTHER_CATEGORY.id, subcategory: null, matched: null };
}

function extractMerchant(text: string, matchedKeyword: string | null): string | null {
  const m = text.match(/\bat\s+([A-Za-z][A-Za-z .&'-]{2,40})/) || text.match(/([\u0980-\u09FFA-Za-z .&'-]{2,40})-এ\b/);
  if (m) return m[1].trim().replace(/[.,;:!?]+$/, "");
  return matchedKeyword && /^[A-Z]/.test(matchedKeyword) ? matchedKeyword : null;
}

function extractDate(text: string, now: Date): { date: Date; note: string | null } {
  const lower = text.toLowerCase();
  const date = new Date(now);
  if (YESTERDAY_WORDS.some((w) => lower.includes(w))) {
    date.setDate(date.getDate() - 1);
    return { date, note: "parsed date: yesterday" };
  }
  if (TODAY_WORDS.some((w) => lower.includes(w))) {
    return { date, note: "parsed date: today" };
  }
  return { date, note: "no date word found — assumed today" };
}

export function parseExpenseText(rawText: string, now = new Date()): ParsedExpense {
  const text = rawText.trim();
  const language = detectLanguage(text);
  const notes: string[] = [];

  const amount = extractAmount(text);
  if (amount === null) notes.push("could not find an amount");

  const lower = text.toLowerCase();
  const isIncome = INCOME_WORDS.some((w) => lower.includes(w.toLowerCase()));
  const hasExpenseVerb = EXPENSE_WORDS.some((w) => lower.includes(w.toLowerCase()));
  const direction: "in" | "out" = isIncome && !hasExpenseVerb ? "in" : "out";
  if (!isIncome && !hasExpenseVerb) notes.push("no explicit spend/receive verb — assumed expense");

  const { category, subcategory, matched } = classifyCategory(text);
  if (!matched) notes.push("no category keyword matched — defaulted to 'other'");

  const merchant = extractMerchant(text, null);
  const { date, note } = extractDate(text, now);
  if (note) notes.push(note);

  let confidence = 0.4;
  if (amount !== null) confidence += 0.25;
  if (matched) confidence += 0.2;
  if (hasExpenseVerb || isIncome) confidence += 0.1;
  if (TODAY_WORDS.concat(YESTERDAY_WORDS).some((w) => lower.includes(w))) confidence += 0.05;
  confidence = Math.min(0.99, Math.round(confidence * 100) / 100);

  return {
    amount,
    currency: "BDT",
    category: direction === "in" ? "income" : category,
    subcategory: direction === "in" ? "salary" : subcategory,
    merchant,
    date: date.toISOString(),
    direction,
    language,
    confidence,
    rawText,
    notes,
  };
}
