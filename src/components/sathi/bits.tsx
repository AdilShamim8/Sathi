"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Pressure, Severity, Confidence } from "@/lib/engine/domain";
import { useLang } from "./i18n";

export function Money({ value, className, sign }: { value: number; className?: string; sign?: boolean }) {
  const abs = Math.abs(Math.round(value));
  const s = value < 0 ? "−" : sign && value > 0 ? "+" : "";
  return <span className={cn("nums", className)}>{s}৳{abs.toLocaleString("en-IN")}</span>;
}

export function PressureBadge({ level, className }: { level: Pressure; className?: string }) {
  const styles: Record<Pressure, string> = {
    low: "bg-leaf/15 text-leafdark border-leaf/40",
    medium: "bg-saffron/15 text-[#9a6a1a] border-saffron/40",
    high: "bg-tomato/15 text-tomato border-tomato/40",
  };
  const dots: Record<Pressure, string> = { low: "●○○", medium: "●●○", high: "●●●" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide", styles[level], className)}>
      <span aria-hidden className="text-[9px] tracking-tight">{dots[level]}</span>
      {level}
    </span>
  );
}

export function RiskBadge({ probability, className }: { probability: number; className?: string }) {
  const pct = Math.round(probability * 100);
  const level = probability >= 0.6 ? "high" : probability >= 0.3 ? "medium" : "low";
  const styles = {
    low: "bg-leaf/15 text-leafdark border-leaf/40",
    medium: "bg-saffron/15 text-[#9a6a1a] border-saffron/40",
    high: "bg-tomato/15 text-tomato border-tomato/40",
  } as const;
  return (
    <span className={cn("nums inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", styles[level], className)}>
      {pct}% risk
    </span>
  );
}

export function SeverityDot({ severity }: { severity: Severity }) {
  const color: Record<Severity, string> = {
    positive: "bg-leaf",
    info: "bg-focusblue",
    warning: "bg-saffron",
    alert: "bg-tomato",
  };
  return <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", color[severity])} aria-hidden />;
}

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
      confidence: {level}
    </span>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{k}</span>
      <span className="nums text-right text-sm font-medium">{v}</span>
    </div>
  );
}

export function SectionTitle({ en, bn, right }: { en: string; bn: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{en}</h2>
        <p className="text-xs text-muted-foreground">{bn}</p>
      </div>
      {right}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">new</span>;
  const up = value > 0;
  return (
    <span className={cn("nums text-xs font-semibold", up ? "text-tomato" : "text-leafdark")}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

/** Status pill for safe-to-spend states. */
export function StatusPill({ status, labelEn, labelBn }: { status: string; labelEn: string; labelBn: string }) {
  const { lang } = useLang();
  const styles: Record<string, string> = {
    comfortable: "bg-leaf/15 text-leafdark border-leaf/40",
    cautious: "bg-saffron/15 text-[#9a6a1a] border-saffron/40",
    tight: "bg-tomato/15 text-tomato border-tomato/50",
    deficit: "bg-tomato text-white border-tomato",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", styles[status] ?? styles.cautious)}>
      {lang === "bn" ? labelBn : labelEn}
    </span>
  );
}

/** Animated number for hero figures — spring count-up via framer-motion. */
export function AnimatedMoney({ value, className }: { value: number; className?: string }) {
  return <Money value={value} className={className} />;
}

/** Bilingual label helper. */
export function Bi({ en, bn }: { en: string; bn: string }) {
  const { lang } = useLang();
  return <>{lang === "bn" ? bn : en}</>;
}
