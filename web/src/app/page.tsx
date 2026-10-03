"use client";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { LangProvider } from "@/components/sathi/i18n";
import { AppShell, type ViewKey } from "@/components/sathi/AppShell";
import { HomeView } from "@/components/sathi/HomeView";
import { TransactionsView } from "@/components/sathi/TransactionsView";
import { SpendingView } from "@/components/sathi/SpendingView";
import { CashFlowView } from "@/components/sathi/CashFlowView";
import { GoalsView } from "@/components/sathi/GoalsView";
import { CopilotView } from "@/components/sathi/CopilotView";
import { InsightsView } from "@/components/sathi/InsightsView";
import { SalarySheet } from "@/components/sathi/SalarySheet";
import { SettingsSheet } from "@/components/sathi/SettingsSheet";
import { OnboardingView } from "@/components/sathi/OnboardingView";

/** Local-only browser state keys that a full reset must clear. */
const LOCAL_KEYS = ["sathi-copilot-history"];

type BootState = "loading" | "onboarding" | "ready";

function SathiApp() {
  const [view, setView] = useState<ViewKey>("home");
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [txnComposeKey, setTxnComposeKey] = useState(0);
  const [bootState, setBootState] = useState<BootState>("loading");
  const [bootNonce, setBootNonce] = useState(0);
  const qc = useQueryClient();

  // Boot gate: the app renders only after /api/boot resolves. When the owner
  // account doesn't exist yet (fresh install or after a reset), onboarding
  // takes over the whole screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/boot", { cache: "no-store" });
        const data = (await res.json()) as { needsOnboarding?: boolean };
        if (!cancelled) setBootState(data?.needsOnboarding ? "onboarding" : "ready");
      } catch {
        // boot failed — let the views surface their own error states
        if (!cancelled) setBootState("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [bootNonce]);

  /** Re-run the boot check (after onboarding or reset) with a clean cache. */
  const recheckBoot = async () => {
    setBootState("loading");
    await qc.invalidateQueries();
    setView("home");
    setBootNonce((n) => n + 1);
  };

  const handleReset = async () => {
    // clear device-local state, then every server query cache
    for (const key of LOCAL_KEYS) {
      try { localStorage.removeItem(key); } catch { /* best-effort */ }
    }
    await recheckBoot();
  };

  const openAddExpense = () => {
    setTxnComposeKey((k) => k + 1);
    setView("transactions");
  };

  if (bootState === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-ink text-2xl font-bold text-leaf shadow-ios-lg">৳</span>
          <p className="animate-pulse text-xs text-muted-foreground">Sathi…</p>
        </motion.div>
      </div>
    );
  }

  if (bootState === "onboarding") {
    return <OnboardingView onDone={recheckBoot} />;
  }

  return (
    <AppShell
      view={view}
      setView={setView}
      onOpenSalary={() => setSalaryOpen(true)}
      onOpenSettings={() => setSettingsOpen(true)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === "home" && <HomeView setView={setView} onAddExpense={openAddExpense} onOpenSalary={() => setSalaryOpen(true)} />}
          {view === "transactions" && (
            <TransactionsView key={txnComposeKey} autoCompose={txnComposeKey > 0} />
          )}
          {view === "spending" && <SpendingView />}
          {view === "cashflow" && <CashFlowView />}
          {view === "goals" && <GoalsView />}
          {view === "copilot" && <CopilotView />}
          {view === "insights" && <InsightsView />}
        </motion.div>
      </AnimatePresence>

      <SalarySheet open={salaryOpen} onOpenChange={setSalaryOpen} />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSalaryOpen={() => setSalaryOpen(true)}
        onReset={handleReset}
      />
    </AppShell>
  );
}

export default function Page() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <SathiApp />
      </LangProvider>
    </QueryClientProvider>
  );
}
