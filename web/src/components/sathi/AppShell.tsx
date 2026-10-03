"use client";
import { useEffect, type ReactNode } from "react";
import { Home, PieChart, Waves, Target, Sparkles, Bell, Wallet, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang, useT } from "./i18n";

export type ViewKey =
  | "home" | "spending" | "copilot" | "cashflow" | "goals"
  | "transactions" | "insights";

const tabs: { key: ViewKey; icon: typeof Home }[] = [
  { key: "home", icon: Home },
  { key: "spending", icon: PieChart },
  { key: "copilot", icon: Sparkles },
  { key: "cashflow", icon: Waves },
  { key: "goals", icon: Target },
];

export function AppShell({
  view,
  setView,
  onOpenSalary,
  onOpenSettings,
  children,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  onOpenSalary: () => void;
  onOpenSettings: () => void;
  children: ReactNode;
}) {
  const { lang, setLang } = useLang();
  const t = useT();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background shadow-[0_0_80px_rgba(28,26,26,0.10)] sm:border-x sm:border-border/60">
      {/* header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => setView("home")} className="press flex items-center gap-2 text-left">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink text-[15px] font-bold text-leaf shadow-ios">৳</span>
          <div className="leading-tight">
            <div className="text-[15px] font-bold tracking-tight">
              Sathi <span className="text-leafdark">সাথী</span>
            </div>
            <div className="text-[10px] text-muted-foreground">আর্থিক স্বাধীনতা সহকারী</div>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSalary}
            className="press flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-ink"
            aria-label={t("salarySettings")}
            title={t("salarySettings")}
          >
            <Wallet className="h-4 w-4" />
          </button>
          <button
            onClick={onOpenSettings}
            className="press flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-ink"
            aria-label={t("settings")}
            title={t("settings")}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="press rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-ink/30"
            aria-label="Toggle language"
          >
            {lang === "en" ? "বাং" : "EN"}
          </button>
          <button
            onClick={() => setView("insights")}
            className={cn(
              "press flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary",
              view === "insights" && "bg-secondary text-ink",
            )}
            aria-label={t("insights")}
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* content */}
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>

      {/* bottom nav — iOS-style with elevated center copilot */}
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-border/70 bg-card/90 pb-safe backdrop-blur-xl">
        <div className="grid grid-cols-5">
          {tabs.map(({ key, icon: Icon }) => {
            const active = view === key || (key === "home" && view === "transactions");
            const isCopilot = key === "copilot";
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className="press flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition"
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-300",
                    isCopilot
                      ? "h-10 w-10 -mt-2 bg-ink text-leaf shadow-ios-lg"
                      : "h-8 w-8",
                    !isCopilot && active && "bg-leaf/20 text-leafdark",
                    !isCopilot && !active && "text-muted-foreground",
                  )}
                >
                  <Icon
                    className={isCopilot ? "h-[19px] w-[19px]" : "h-[17px] w-[17px]"}
                    strokeWidth={active || isCopilot ? 2.4 : 2}
                  />
                </span>
                <span className={cn(
                  "transition-colors",
                  active ? "font-semibold text-ink" : "text-muted-foreground",
                )}>
                  {t(key === "home" ? "home" : key)}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
