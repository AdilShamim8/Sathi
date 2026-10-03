"use client";
/** Money/date formatting helpers. All numbers render tabular via .nums class. */

export function bdt(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(Math.round(n));
  const formatted = `৳${abs.toLocaleString("en-IN")}`;
  if (opts.sign) return `${n < 0 ? "−" : n > 0 ? "+" : ""}${formatted}`;
  return n < 0 ? `−${formatted}` : formatted;
}

export function pct(n: number | null, digits = 0): string {
  if (n === null || Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function fmtTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today · আজ";
  if (date.toDateString() === yest.toDateString()) return "Yesterday · গতকাল";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
