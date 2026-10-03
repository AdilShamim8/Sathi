/**
 * Time utilities — ported from Sathi core/timeutils.py.
 *
 * All calendar reasoning happens in the Asia/Dhaka day (UTC+6, no DST).
 * The engine never reasons about a "day" in any other timezone.
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // UTC+06:00, no DST

/** The Dhaka calendar date of an instant (UTC timestamp). */
export function dhakaDate(ts: Date | string): Date {
  const t = typeof ts === "string" ? new Date(ts) : ts;
  // Shift into Dhaka wall-clock, then read the UTC date fields.
  return new Date(t.getTime() + DHAKA_OFFSET_MS);
}

/** Dhaka (year, month 1-12, day 1-31) triple of an instant. */
export function dhakaYmd(ts: Date | string): { y: number; m: number; d: number } {
  const dd = dhakaDate(ts);
  return { y: dd.getUTCFullYear(), m: dd.getUTCMonth() + 1, d: dd.getUTCDate() };
}

/** Day-of-month (Dhaka) of an instant, 1..31. */
export function dayOfMonth(ts: Date | string): number {
  return dhakaYmd(ts).d;
}

/** ISO weekday (Mon=1..Sun=7, Dhaka calendar) of an instant. */
export function isoWeekday(ts: Date | string): number {
  const dd = dhakaDate(ts);
  const wd = dd.getUTCDay(); // Sun=0..Sat=6
  return wd === 0 ? 7 : wd;
}

/** ISO (year, week) pair (Dhaka calendar). */
export function isoWeek(ts: Date | string): { year: number; week: number } {
  const dd = dhakaDate(ts);
  // Thursday algorithm: shift so the ISO week's Thursday falls in the same year.
  const day = dd.getUTCDate();
  const wd = dd.getUTCDay() === 0 ? 7 : dd.getUTCDay();
  const thursday = new Date(Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), day + (4 - wd)));
  const year = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.floor((thursday.getTime() - jan1.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return { year, week };
}

/** Add whole months to a date, clamping the day (Jan 31 + 1m → Feb 28/29). */
export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1));
  const dim = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, dim));
  return target;
}

/** Whole days between two Dhaka dates (b - a). */
export function daysBetween(a: Date, b: Date): number {
  const ad = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bd = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bd - ad) / (24 * 3600 * 1000));
}

/** Shift a Date by N days (keeps wall clock). */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 3600 * 1000);
}

/* ---------------- day-index arithmetic (ML pipeline port) ----------------
 * The Sathi ML modules (panel, streams, liquidity simulation) do heavy date
 * math: add days, diff days, month anchors. To keep it exact and cheap we
 * represent a Dhaka calendar day as an integer count of days since the epoch
 * (a "Day"), always derived from a UTC-midnight Date. */

export type Day = number;

/** Day index of a UTC-midnight Date. */
export function toDay(d: Date): Day {
  return Math.round(d.getTime() / (24 * 3600 * 1000));
}

/** UTC-midnight Date for a day index. */
export function fromDay(day: Day): Date {
  return new Date(day * 24 * 3600 * 1000);
}

/** Day index for an ISO YYYY-MM-DD string. */
export function isoDay(iso: string): Day {
  return toDay(new Date(`${iso}T00:00:00Z`));
}

/** ISO YYYY-MM-DD for a day index. */
export function dayIso(day: Day): string {
  return fromDay(day).toISOString().slice(0, 10);
}

/** Day-of-month (1..31) of a day index. */
export function domOfDay(day: Day): number {
  return fromDay(day).getUTCDate();
}

/** Weekday (0=Mon .. 6=Sun, like Python's date.weekday()) of a day index. */
export function weekdayOfDay(day: Day): number {
  return (fromDay(day).getUTCDay() + 6) % 7;
}

/** Day index of the first of the month containing `day`. */
export function firstOfMonth(day: Day): Day {
  const d = fromDay(day);
  return toDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

/**
 * The day index of `dom` in the month `monthOffset` relative to the month of
 * `anchorMonthFirst` (0 = same month), clamped to the month length (like
 * Python's date(y, mo, min(dom, 28)) for anchors, but general).
 */
export function monthAnchorDay(anchorMonthFirst: Day, monthOffset: number, dom: number): Day {
  const first = fromDay(anchorMonthFirst);
  const target = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + monthOffset, 1));
  const dim = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return toDay(new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(dom, dim))));
}
