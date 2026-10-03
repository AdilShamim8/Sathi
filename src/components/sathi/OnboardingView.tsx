"use client";
/**
 * First-launch onboarding: the app asks who it belongs to, offers an
 * optional salary setting, and lets the owner choose between a fresh
 * personal ledger and the seeded synthetic demo history.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Wallet, ShieldCheck, Leaf } from "lucide-react";
import { api } from "./api";
import { useLang } from "./i18n";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

export function OnboardingView({ onDone }: { onDone: () => void }) {
  const { lang } = useLang();
  const [name, setName] = useState("Adil Shamim");
  const [salary, setSalary] = useState("");
  const [balance, setBalance] = useState("");
  const [mode, setMode] = useState<"personal" | "demo">("personal");
  const [pending, setPending] = useState<"personal" | "demo" | null>(null);

  const start = async (chosen: "personal" | "demo") => {
    if (pending) return;
    setPending(chosen);
    try {
      await api.completeOnboarding({
        name: name.trim() || "Adil Shamim",
        mode: chosen,
        salaryAmount: salary.trim() === "" ? null : parseInt(salary, 10),
        openingBalance: balance.trim() === "" ? 0 : parseInt(balance, 10),
      });
      toast({
        title: lang === "bn" ? `স্বাগতম, ${name.trim() || "Adil Shamim"}!` : `Welcome, ${name.trim() || "Adil Shamim"}!`,
        description: chosen === "demo"
          ? (lang === "bn" ? "ডেমো ডেটা লোড হয়েছে — যখন খুশি রিসেট করুন" : "Demo data loaded — reset anytime from Settings")
          : (lang === "bn" ? "আপনার ডেটা এই ডিভাইসেই থাকবে" : "Your data stays on this device"),
      });
      onDone();
    } catch (e) {
      setPending(null);
      toast({ title: "Setup failed", description: e instanceof Error ? e.message : "Please try again", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background px-5 pb-8 pt-10">
      {/* brand */}
      <motion.div {...fadeUp} className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-ink text-xl font-bold text-leaf shadow-ios-lg">৳</span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">
          Sathi <span className="text-leafdark">সাথী</span>
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {lang === "bn"
            ? "আপনার ব্যক্তিগত ক্যাশ-ফ্লো সহকারী — নিরাপদ ব্যয়, ঝুঁকি পূর্বাভাস ও লক্ষ্য পরিকল্পনা"
            : "Your personal cash-flow companion — safe-to-spend, risk forecasts and goal planning"}
        </p>
      </motion.div>

      {/* name */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.06 }} className="mt-6">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="ob-name">
          {lang === "bn" ? "আপনার নাম" : "Your name"}
        </label>
        <input
          id="ob-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder="Adil Shamim"
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-lg font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
        />
      </motion.div>

      {/* optional salary */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="mt-3">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="ob-salary">
          {lang === "bn" ? "মাসিক বেতন (ঐচ্ছিক — পরে বদলানো যাবে)" : "Monthly salary (optional — change anytime)"}
        </label>
        <div className="relative mt-1">
          <input
            id="ob-salary"
            value={salary}
            onChange={(e) => setSalary(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
            inputMode="numeric"
            placeholder="30000"
            className="nums w-full rounded-xl border border-input bg-background px-3 py-3 pr-12 text-lg font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
          />
          <Wallet className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {lang === "bn"
            ? "বেতন সেট করলে পূর্বাভাস আরও নির্ভুল হয়। আয়ের ধরন আমরা আপনার লেনদেন থেকেও শিখি।"
            : "Setting salary sharpens forecasts. We also learn income patterns from your transactions."}
        </p>
      </motion.div>

      {/* optional wallet balance (personal mode) */}
      {mode === "personal" && (
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.12 }} className="mt-3">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ob-balance">
            {lang === "bn" ? "এখন ওয়ালেটে কত আছে? (ঐচ্ছিক)" : "Wallet balance right now (optional)"}
          </label>
          <div className="relative mt-1">
            <input
              id="ob-balance"
              value={balance}
              onChange={(e) => setBalance(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="5000"
              className="nums w-full rounded-xl border border-input bg-background px-3 py-3 pr-12 text-lg font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
            />
            <Wallet className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {lang === "bn"
              ? "নগদ হিসাবের শুরু হবে এখান থেকে — পরে সেটিংস থেকে বদলানো যাবে।"
              : "Your cash-on-hand starts from this number — adjustable later in Settings."}
          </p>
        </motion.div>
      )}

      {/* mode choice */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.14 }} className="mt-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {lang === "bn" ? "কীভাবে শুরু করতে চান?" : "How would you like to start?"}
        </p>

        <button
          onClick={() => mode !== "personal" && setMode("personal")}
          className={cn(
            "press w-full rounded-2xl border p-4 text-left transition",
            mode === "personal" ? "border-leafdark bg-leaf/5 shadow-ios" : "border-border bg-card hover:border-ink/25",
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", mode === "personal" ? "bg-leaf/20 text-leafdark" : "bg-secondary text-ink")}>
              <Leaf className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{lang === "bn" ? "ফ্রেশ শুরু" : "Start fresh"} · {lang === "bn" ? "নিজের ডেটা" : "my own data"}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {lang === "bn"
                  ? "খালি খাতা — আয়-খরচ নিজে যোগ করুন, সব ডেটা আপনার ডিভাইসে"
                  : "An empty ledger — add your own income and expenses; everything stays on your device"}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => mode !== "demo" && setMode("demo")}
          className={cn(
            "press w-full rounded-2xl border p-4 text-left transition",
            mode === "demo" ? "border-leafdark bg-leaf/5 shadow-ios" : "border-border bg-card hover:border-ink/25",
          )}
        >
          <div className="flex items-center gap-2.5">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", mode === "demo" ? "bg-leaf/20 text-leafdark" : "bg-secondary text-ink")}>
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{lang === "bn" ? "ডেমো ডেটা দিয়ে ঘুরে দেখুন" : "Explore with demo data"}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {lang === "bn"
                  ? "৬ মাসের সিন্থেটিক ইতিহাস — সব ফিচার দেখতে; সেটিংস থেকে যেকোনো সময় রিসেট করুন"
                  : "6 months of synthetic history to see every feature; reset anytime from Settings"}
              </p>
            </div>
          </div>
        </button>
      </motion.div>

      {/* start */}
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.18 }} className="mt-5">
        <button
          onClick={() => start(mode)}
          disabled={pending !== null}
          className="press flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-ios-lg transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          {pending
            ? (lang === "bn" ? "প্রস্তুত হচ্ছে…" : "Setting up…")
            : (lang === "bn" ? "শুরু করুন" : "Get started")}
          {!pending && <ArrowRight className="h-4 w-4" />}
        </button>
        <p className="mt-2.5 flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-leafdark" />
          {lang === "bn"
            ? "কোনো ব্যাংক সংযোগ নেই। সব ডেটা এই ডিভাইসে সংরক্ষিত — রিসেট করলে সম্পূর্ণ মুছে যায়।"
            : "No bank connections. All data is stored on this device — a reset deletes it completely."}
        </p>
      </motion.div>
    </div>
  );
}
