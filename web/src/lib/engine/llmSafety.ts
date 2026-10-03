/**
 * Prompt sanitizer + numeric validator — ported from Sathi
 * llm/sanitizer.py and llm/validator.py (reference invariants 1, 2, 7).
 *
 * The sanitizer protects the LLM layer from prompt injection, system
 * leakage, jailbreak attempts and instructions attempting money movement.
 * The validator enforces that every figure in LLM-generated text matches a
 * figure from verified engine output; on ANY failure the system fails
 * closed to a reviewed deterministic template.
 */

import { toEnglishDigits } from "./formatting";

/* ---------------- sanitizer ---------------- */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /system\s+prompt/i,
  /you\s+are\s+now/i,
  /dan\s+mode/i,
  /reveal\s+(api\s+)?key/i,
  /transfer\s+money/i,
  /send\s+taka/i,
  /approve\s+loan/i,
  /disregard\s+rules/i,
  /bypass\s+safety/i,
  /টাকা\s*পাঠাও/,
  /টাকা\s*কাটো/,
  /লোন\s*অনুমোদন/,
  /নিয়ম\s*ভুলে\s*যাও/,
];

export interface SanitizeResult {
  cleanedText: string;
  isSafe: boolean;
}

/** NFC-normalize, strip control characters, and flag adversarial patterns. */
export function sanitizeInput(text: string): SanitizeResult {
  if (!text) return { cleanedText: "", isSafe: true };
  // 1. Normalize unicode (NFC).
  const normalized = text.normalize("NFC");
  // 2. Strip non-printable control characters (except newline, tab).
  const cleaned = Array.from(normalized)
    .filter((ch) => ch === "\n" || ch === "\t" || !/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/u.test(ch))
    .join("")
    .trim();
  // 3. Check for adversarial injection or prohibited intent patterns.
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) return { cleanedText: cleaned, isSafe: false };
  }
  return { cleanedText: cleaned, isSafe: true };
}

/* ---------------- numeric validator ---------------- */

const NUM_PATTERN = /(\d+(?:[,.]\d+)?)/g;

/**
 * Number words (English + Bangla). A verbal figure is as hallucinable as a
 * digit figure, so both are extracted and validated against the same
 * allowlist ("five thousand", "পাঁচ হাজার" -> 5000).
 */
const EN_UNIT_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const EN_SCALE_WORDS: Record<string, number> = {
  hundred: 100, thousand: 1000, k: 1000, lakh: 100000, crore: 10000000, million: 1000000,
};
const BN_UNIT_WORDS: Record<string, number> = {
  "শূন্য": 0, "এক": 1, "দুই": 2, "তিন": 3, "চার": 4, "পাঁচ": 5, "ছয়": 6,
  "সাত": 7, "আট": 8, "নয়": 9, "দশ": 10, "এগারো": 11, "বারো": 12,
  "তেরো": 13, "চৌদ্দ": 14, "পনেরো": 15, "ষোলো": 16, "সতেরো": 17,
  "আঠারো": 18, "উনিশ": 19, "বিশ": 20, "ত্রিশ": 30, "চল্লিশ": 40,
  "পঞ্চাশ": 50, "ষাট": 60, "সত্তর": 70, "আশি": 80, "নব্বই": 90,
};
const BN_SCALE_WORDS: Record<string, number> = {
  "শত": 100, "হাজার": 1000, "লাখ": 100000, "কোটি": 10000000,
};
const WORD_TOKEN_RE = /[A-Za-z\u0980-\u09FF]+/g;

function parseWordNumber(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let sawAny = false;
  for (const tok of tokens) {
    const low = tok.toLowerCase();
    if (low in EN_UNIT_WORDS || tok in BN_UNIT_WORDS) {
      current += (EN_UNIT_WORDS[low] ?? BN_UNIT_WORDS[tok])!;
      sawAny = true;
    } else if (low in EN_SCALE_WORDS || tok in BN_SCALE_WORDS) {
      const scale = (EN_SCALE_WORDS[low] ?? BN_SCALE_WORDS[tok])!;
      total += (current || 1) * scale;
      current = 0;
      sawAny = true;
    } else {
      return null;
    }
  }
  return sawAny ? total + current : null;
}

/** Extract numbers written as EN/BN words ("five thousand", "পাঁচ হাজার"). */
export function extractNumberWords(text: string): Set<number> {
  const out = new Set<number>();
  const tokens = Array.from(text.matchAll(WORD_TOKEN_RE)).map((m) => m[0]);
  const isWord = (t: string): boolean =>
    t.toLowerCase() in EN_UNIT_WORDS || t.toLowerCase() in EN_SCALE_WORDS || t in BN_UNIT_WORDS || t in BN_SCALE_WORDS;
  let i = 0;
  while (i < tokens.length) {
    if (isWord(tokens[i]!)) {
      let j = i;
      while (j < tokens.length && isWord(tokens[j]!)) j++;
      const val = parseWordNumber(tokens.slice(i, j));
      if (val !== null) out.add(Math.round(val * 100) / 100);
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

/** Extract all numbers from text, normalizing Bengali digits and commas. */
export function extractNumbers(text: string): Set<number> {
  const textEn = toEnglishDigits(text);
  // Remove comma/thousands separators between digits (25,000 → 25000).
  const cleaned = textEn.replace(/(?<=\d),(?=\d)/g, "");
  const numbers = new Set<number>();
  for (const m of cleaned.matchAll(NUM_PATTERN)) {
    const val = Number.parseFloat(m[1]!);
    if (Number.isNaN(val)) continue;
    numbers.add(Math.round(val * 100) / 100);
    if (Number.isInteger(val)) numbers.add(val);
  }
  for (const w of extractNumberWords(text)) numbers.add(w);
  return numbers;
}

export interface ValidationResult {
  passed: boolean;
  hallucinatedNumbers: number[];
  extractedNumbers: number[];
}

/**
 * Validate that every number in generated text is grounded in the allowed
 * set (directly or within a small tolerance). If any number is not
 * grounded, returns passed=false → the caller fails closed.
 */
export function validateNumbers(
  generatedText: string,
  allowedNumbers: Iterable<number>,
): ValidationResult {
  const extracted = extractNumbers(generatedText);
  const normalizedAllowed = new Set<number>();
  for (const n of allowedNumbers) {
    normalizedAllowed.add(Math.round(n * 100) / 100);
    if (Number.isInteger(n)) normalizedAllowed.add(n);
  }
  const hallucinated: number[] = [];
  for (const num of extracted) {
    let matched = false;
    for (const allowed of normalizedAllowed) {
      if (Math.abs(num - allowed) < 0.01) {
        matched = true;
        break;
      }
    }
    if (!matched) hallucinated.push(num);
  }
  return {
    passed: hallucinated.length === 0,
    hallucinatedNumbers: [...hallucinated].sort((a, b) => a - b),
    extractedNumbers: [...extracted].sort((a, b) => a - b),
  };
}
