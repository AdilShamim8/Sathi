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

/** Extract all numbers from text, normalizing Bengali digits and commas. */
export function extractNumbers(text: string): Set<number> {
  const textEn = toEnglishDigits(text);
  // Remove comma/thousands separators between digits (25,000 → 25000).
  const cleaned = textEn.replace(/(?<=\d),(?=\d)/g, "");
  const numbers = new Set<number>();
  for (const m of cleaned.matchAll(NUM_PATTERN)) {
    const val = Number.parseFloat(m[1]);
    if (Number.isNaN(val)) continue;
    numbers.add(Math.round(val * 100) / 100);
    if (Number.isInteger(val)) numbers.add(val);
  }
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
