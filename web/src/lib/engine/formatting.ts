/**
 * Display formatting — ported from Sathi core/formatting.py.
 *
 * Every number shown to a Bangla-locale user is rendered here, once, so a
 * template never computes or formats anything itself. Bangla digits and the
 * ৳ symbol are first-class, not an afterthought.
 */

import { dhakaYmd } from "./timeutils";

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export type Locale = "bn" | "en";

/** Transliterate ASCII digits to Bangla digits. */
export function toBanglaDigits(text: string | number): string {
  return String(text).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

/** Transliterate Bangla digits back to ASCII (for parsing user input). */
export function toEnglishDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

function groupDigits(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Format a taka amount: bn → "৳১,৫০০" style with Bangla digits; en → "৳1,500". */
export function formatTaka(taka: number, locale: Locale = "bn"): string {
  const sign = taka < 0 ? "-" : "";
  const grouped = groupDigits(Math.abs(taka));
  const s = `${sign}৳${grouped}`;
  return locale === "bn" ? toBanglaDigits(s) : s;
}

/** Format a probability/ratio as a percentage string. */
export function formatProbability(p: number, locale: Locale = "bn"): string {
  const pct = `${Math.round(p * 100)}%`;
  return locale === "bn" ? toBanglaDigits(pct) : pct;
}

/** Format a Dhaka date like "১৫ মার্চ" / "15 Mar". */
export function formatDate(d: Date, locale: Locale = "bn"): string {
  const { y, m, d: day } = dhakaYmd(d);
  const monthsBn = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (locale === "bn") {
    return toBanglaDigits(`${day} ${monthsBn[m - 1]} ${y}`);
  }
  return `${day} ${monthsEn[m - 1]} ${y}`;
}

/** Format a day count ("১৪ দিন" / "14 days"). */
export function formatDays(days: number, locale: Locale = "bn"): string {
  const rounded = Math.round(days);
  return locale === "bn"
    ? `${toBanglaDigits(rounded)} দিন`
    : `${rounded} ${rounded === 1 ? "day" : "days"}`;
}
