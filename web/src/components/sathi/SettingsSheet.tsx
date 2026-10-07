"use client";
/**
 * Settings sheet: profile name, salary shortcut, language, data & privacy
 * overview, and the destructive Reset-all-data flow (double confirmation).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Check, Database, Trash2, Wallet, Languages, ShieldCheck, AlertTriangle } from "lucide-react";
import { api } from "./api";
import { getOpenRouterConfig, setOpenRouterConfig, testOpenRouterKey, type OpenRouterTestResult } from "@/lib/engine/openrouterChat";
import { aiStatusMessage } from "@/lib/engine/aiStatus";
import { useLang } from "./i18n";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { BootPayload } from "./api";

export function SettingsSheet({
  open,
  onOpenChange,
  onSalaryOpen,
  onReset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSalaryOpen: () => void;
  onReset: () => void;
}) {
  const { lang, setLang } = useLang();
  const qc = useQueryClient();

  const { data: boot } = useQuery<BootPayload>({ queryKey: ["boot"], queryFn: api.boot, enabled: open });
  const { data: txns } = useQuery({ queryKey: ["transactions"], queryFn: () => api.transactions({ limit: 500 }), enabled: open });
  const { data: goals } = useQuery({ queryKey: ["goals"], queryFn: api.goals, enabled: open });
  const { data: salary } = useQuery({ queryKey: ["salary"], queryFn: api.salary, enabled: open });
  const sharedAI = useQuery({ queryKey: ["ai-status"], queryFn: api.aiStatus, enabled: open });

  const [name, setName] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [cashOnHand, setCashOnHand] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Optional online AI chat (user's own OpenRouter key, device-local).
  const { data: inputsData } = useQuery({ queryKey: ["inputs"], queryFn: api.inputs, enabled: open });
  const [orKey, setOrKey] = useState<string | null>(null);
  const [orModel, setOrModel] = useState<string | null>(null);
  const [orEnabled, setOrEnabled] = useState<boolean | null>(null);
  const [orTest, setOrTest] = useState<OpenRouterTestResult | null>(null);
  const [orTesting, setOrTesting] = useState(false);
  const orConfig = getOpenRouterConfig();
  const orOn = orEnabled ?? orConfig.enabled;
  const orKeyValue = orKey ?? orConfig.apiKey;
  const orModelValue = orModel ?? orConfig.model;

  const runOrTest = async () => {
    setOrTesting(true);
    setOrTest(null);
    try {
      const result = await testOpenRouterKey(orKeyValue, orModelValue || undefined);
      setOrTest(result);
    } finally {
      setOrTesting(false);
    }
  };

  const saveName = useMutation({
    mutationFn: () => api.updateProfile({ name: (name ?? "").trim() }),
    onSuccess: async () => {
      toast({ title: lang === "bn" ? "নাম সংরক্ষিত" : "Name saved" });
      setName(null);
      await qc.invalidateQueries({ queryKey: ["boot"] });
      await qc.invalidateQueries({ queryKey: ["summary"] });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const saveBalance = useMutation({
    mutationFn: () => api.updateProfile({ openingBalance: parseInt(balance ?? "0", 10) || 0 }),
    onSuccess: async () => {
      toast({ title: lang === "bn" ? "শুরুর ব্যালেন্স সংরক্ষিত" : "Starting balance saved" });
      setBalance(null);
      await qc.invalidateQueries({ queryKey: ["summary"] });
      await qc.invalidateQueries({ queryKey: ["forecast"] });
      await qc.invalidateQueries({ queryKey: ["salary"] });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const saveCashOnHand = useMutation({
    mutationFn: () => api.updateInputs({ cashOnHandTaka: parseInt(cashOnHand ?? "0", 10) || 0 }),
    onSuccess: async () => {
      toast({ title: lang === "bn" ? "নগদ সংরক্ষিত" : "Cash on hand saved" });
      setCashOnHand(null);
      await qc.invalidateQueries({ queryKey: ["summary"] });
      await qc.invalidateQueries({ queryKey: ["forecast"] });
      await qc.invalidateQueries({ queryKey: ["inputs"] });
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const reset = useMutation({
    mutationFn: api.resetAllData,
    onSuccess: () => {
      onOpenChange(false);
      setConfirmReset(false);
      onReset();
    },
    onError: (e: Error) => toast({ title: lang === "bn" ? "রিসেট ব্যর্থ" : "Reset failed", description: e.message, variant: "destructive" }),
  });

  if (!open) return null;

  const displayName = name ?? boot?.user?.name ?? "";
  const displayBalance = balance ?? (salary ? String(salary.openingBalance ?? 0) : "");
  const txnCount = txns?.length ?? 0;
  const goalCount = goals?.length ?? 0;
  const isDemo = boot?.user?.mode === "demo";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={() => { onOpenChange(false); setConfirmReset(false); }}
      />
      <div className="thin-scrollbar relative z-10 max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 pb-safe shadow-ios-lg sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
            <Settings className="h-5 w-5 text-ink" />
          </span>
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              {lang === "bn" ? "সেটিংস" : "Settings"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {lang === "bn" ? "প্রোফাইল, ডেটা ও গোপনীয়তা" : "Profile, data & privacy"}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {/* name */}
          <section>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="set-name">
              {lang === "bn" ? "আপনার নাম" : "Your name"}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="set-name"
                value={displayName}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                placeholder="Adil Shamim"
                className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
              />
              <button
                onClick={() => saveName.mutate()}
                disabled={saveName.isPending || name === null || name.trim().length < 2}
                className="press rounded-xl bg-ink px-3.5 text-sm font-semibold text-leaf shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
              >
                {saveName.isPending ? "…" : <Check className="h-4 w-4" />}
              </button>
            </div>
          </section>

          {/* starting balance (cash-on-hand anchor) */}
          <section>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="set-balance">
              {lang === "bn" ? "শুরুর ওয়ালেট ব্যালেন্স (৳)" : "Starting wallet balance (৳)"}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="set-balance"
                value={displayBalance}
                onChange={(e) => setBalance(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                inputMode="numeric"
                placeholder="0"
                className="nums min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
              />
              <button
                onClick={() => saveBalance.mutate()}
                disabled={saveBalance.isPending || balance === null || balance.trim() === ""}
                className="press rounded-xl bg-ink px-3.5 text-sm font-semibold text-leaf shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
              >
                {saveBalance.isPending ? "…" : <Check className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {lang === "bn"
                ? "আপনার ইতিহাসের শুরুতে ওয়ালেটে যত ছিল — নগদ হিসাব এখান থেকে শুরু হয়"
                : "What your wallet held when your Sathi history began — cash-on-hand starts from here"}
            </p>
          </section>

          {/* cash on hand right now (user correction, decays at observed burn) */}
          <section>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="set-cash">
              {lang === "bn" ? "এখন হাতে নগদ (৳)" : "Cash in hand right now (৳)"}
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="set-cash"
                value={cashOnHand ?? (inputsData ? String(inputsData.cashOnHandTaka ?? "") : "")}
                onChange={(e) => setCashOnHand(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
                inputMode="numeric"
                placeholder="0"
                className="nums min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
              />
              <button
                onClick={() => saveCashOnHand.mutate()}
                disabled={saveCashOnHand.isPending || cashOnHand === null || cashOnHand.trim() === ""}
                className="press rounded-xl bg-ink px-3.5 text-sm font-semibold text-leaf shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
              >
                {saveCashOnHand.isPending ? "…" : <Check className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {lang === "bn"
                ? "আপনার ঘোষণা ১৪ দিন প্রযোজ্য, তারপর পর্যবেক্ষিত নগদ খরচের হারে কমতে থাকে — তাই পুরনো ঘোষণা কখনো বাড়তি স্বাচ্ছন্দ্য দেখায় না"
                : "Your declaration holds for 14 days, then decays at your observed cash-burn rate — a stale entry never overstates your liquidity"}
            </p>
          </section>

          {/* salary + language */}
          <section className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80">
            <button
              onClick={() => { onOpenChange(false); onSalaryOpen(); }}
              className="press flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-secondary/50"
            >
              <Wallet className="h-4 w-4 shrink-0 text-leafdark" />
              <span className="flex-1 text-sm font-medium">{lang === "bn" ? "বেতন সেটিংস" : "Salary settings"}</span>
              <span className="text-[11px] text-muted-foreground">→</span>
            </button>
            <div className="flex items-center gap-3 px-3.5 py-3">
              <Languages className="h-4 w-4 shrink-0 text-leafdark" />
              <span className="flex-1 text-sm font-medium">{lang === "bn" ? "ভাষা" : "Language"}</span>
              <button
                onClick={() => setLang(lang === "en" ? "bn" : "en")}
                className="press rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-ink/30"
              >
                {lang === "en" ? "বাংলা করুন" : "Switch to English"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5">
            <p className="text-sm font-semibold">{lang === "bn" ? "সাইটের অনলাইন এআই" : "Site's online AI"}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {sharedAI.data ? aiStatusMessage(sharedAI.data, lang)
                : sharedAI.isError ? (lang === "bn" ? "এআই সেটিং যাচাই করা যায়নি। আবার চেষ্টা করুন।" : "Could not check AI settings. Try again.")
                : (lang === "bn" ? "সেটিং যাচাই হচ্ছে…" : "Checking settings…")}
            </p>
            {sharedAI.data?.provider && <p className="mt-1 text-[11px] text-muted-foreground">{sharedAI.data.provider} · {sharedAI.data.model}</p>}
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {lang === "bn" ? "Groq-এর ফ্রি টিয়ারে ব্যবহারের সীমা আছে। OpenAI-এর ChatGPT মডেলের জন্য আলাদা পেইড API অ্যাকাউন্ট লাগে।" : "Groq offers a free tier with usage limits. OpenAI's ChatGPT models need a separate paid API account."}
            </p>
            <button onClick={() => sharedAI.refetch()} disabled={sharedAI.isFetching} className="press mt-2 rounded-xl border border-border px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40">
              {lang === "bn" ? "অবস্থা আবার দেখুন" : "Refresh status"}
            </button>
          </section>

          {/* OPTIONAL online AI chat — user's own OpenRouter key */}
          <section className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-leafdark" />
              <p className="text-sm font-semibold">
                {lang === "bn" ? "আপনার OpenRouter কী (ঐচ্ছিক)" : "Your own OpenRouter key (optional)"}
              </p>
              <button
                role="switch"
                aria-label={lang === "bn" ? "আপনার OpenRouter কী ব্যবহার করুন" : "Use your own OpenRouter key"}
                aria-checked={orOn}
                onClick={() => { setOrEnabled(!orOn); setOpenRouterConfig({ enabled: !orOn }); }}
                className={cn(
                  "press ml-auto h-6 w-11 rounded-full border transition",
                  orOn ? "border-leafdark bg-leaf/60" : "border-border bg-background",
                )}
              >
                <span
                  className={cn(
                    "block h-4.5 w-4.5 rounded-full bg-card shadow transition-transform",
                    "h-[18px] w-[18px]",
                    orOn ? "translate-x-[22px]" : "translate-x-[3px]",
                  )}
                />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {lang === "bn"
                ? "চালু করলে সাইটের এআইয়ের বদলে আপনার নিজের কী ব্যবহার হবে। কী শুধু এই ডিভাইসে থাকে ও সরাসরি openrouter.ai-তে যায়। ব্যর্থ হলে অ্যাপের নিজস্ব উত্তর থাকে।"
                : "When enabled with a key, this replaces the site's AI for your questions. Your key stays on this device and goes only to openrouter.ai. If it fails, the built-in answer remains."}
            </p>
            {orOn && (
              <div className="mt-2.5 space-y-2">
                <input
                  type="password"
                  value={orKeyValue}
                  onChange={(e) => { const value = e.target.value.trim(); setOrKey(value); setOpenRouterConfig({ apiKey: value }); setOrTest(null); }}
                  placeholder="sk-or-v1-…"
                  aria-label="OpenRouter API key"
                  className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
                />
                <input
                  value={orModelValue}
                  onChange={(e) => { const value = e.target.value.trim(); setOrModel(value); setOpenRouterConfig({ model: value }); setOrTest(null); }}
                  placeholder="openrouter/free"
                  aria-label="OpenRouter model"
                  className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
                />
                <div className="flex items-center gap-2 text-[11px]">
                  <button onClick={() => { setOrModel("openrouter/free"); setOpenRouterConfig({ model: "openrouter/free" }); setOrTest(null); }} className="press rounded-xl border border-border px-3 py-1.5 font-semibold">
                    {lang === "bn" ? "ফ্রি মডেল ব্যবহার করুন" : "Use free models"}
                  </button>
                  <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer" className="text-leafdark underline">{lang === "bn" ? "কী তৈরি করুন" : "Get a key"}</a>
                </div>
                <p className="text-[10px] text-muted-foreground">{lang === "bn" ? "ফ্রি মডেলেও কী লাগে, আর ব্যবহারের সীমা আছে।" : "Free models still need a key and have usage limits."}</p>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  {lang === "bn"
                    ? "মডেল কখনো টাকা হিসাব করে না — সংখ্যাগুলো অ্যাপের হিসাব থেকে স্লটে বসে যায়।"
                    : "The model never computes money — numbers are slotted in from the app's own calculations."}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={runOrTest}
                    disabled={orTesting || !orKeyValue}
                    className="press rounded-xl border border-leafdark/40 px-3 py-1.5 text-[11px] font-semibold text-leafdark transition enabled:hover:bg-leaf/10 disabled:opacity-40"
                  >
                    {orTesting
                      ? (lang === "bn" ? "পরীক্ষা চলছে…" : "Testing…")
                      : (lang === "bn" ? "কী পরীক্ষা করুন" : "Test key")}
                  </button>
                  {orTest && (
                    <p className={cn("text-[11px] leading-snug", orTest.ok ? "text-leafdark" : "text-tomato")}>
                      {orTest.reason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* data & privacy */}
          <section className="rounded-2xl border border-border/80 bg-secondary/30 p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Database className="h-4 w-4 text-ink" />
              {lang === "bn" ? "ডেটা ও গোপনীয়তা" : "Data & privacy"}
            </p>
            <div className="mt-2 space-y-1 text-[12px] leading-relaxed text-muted-foreground">
              <p>
                {lang === "bn" ? "লেনদেন" : "Transactions"}: <span className="nums font-semibold text-ink">{txnCount}</span>
                {" · "}{lang === "bn" ? "লক্ষ্য" : "Goals"}: <span className="nums font-semibold text-ink">{goalCount}</span>
                {isDemo && <span className="ml-1 rounded-full bg-saffron/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#9a6a1a]">DEMO DATA</span>}
              </p>
              <p className="flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-leafdark" />
                {lang === "bn"
                  ? "আপনার হিসাব সাইটের ডেটাবেসে থাকে; চ্যাটের ইতিহাস এই ডিভাইসে থাকে। অনলাইন এআই ব্যবহার করলে আপনার প্রশ্ন ও প্রয়োজনীয় আর্থিক তথ্য নির্বাচিত প্রোভাইডারে যায়।"
                  : "Your ledger is stored in the site's database; chat history stays on this device. Online AI sends your question and relevant financial evidence to the selected provider."}
              </p>
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-saffron" />
                {lang === "bn"
                  ? "কোপাইলটের উত্তর বানানোর জন্য প্রশ্ন ও হিসাব করা সারসংক্ষেপ AI ভাষা সেবাতে যায় — কাঁচা লেনদেন কখনো নয়।"
                  : "Copilot sends your question plus computed aggregates to the AI language service for phrasing — never raw transactions."}
              </p>
            </div>
          </section>

          {/* reset */}
          <section className={cn("rounded-2xl border p-3.5", confirmReset ? "border-tomato/50 bg-tomato/5" : "border-border/80")}>
            <p className="flex items-center gap-2 text-sm font-semibold text-tomato">
              <Trash2 className="h-4 w-4" />
              {lang === "bn" ? "সব ডেটা মুছে ফেলুন" : "Reset / delete all data"}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {lang === "bn"
                ? "সব লেনদেন, লক্ষ্য, ইনসাইট ও চ্যাট ইতিহাস স্থায়ীভাবে মুছে যাবে এবং অ্যাপ প্রথম অবস্থায় ফিরে যাবে।"
                : "Permanently deletes all transactions, goals, insights and chat history, and returns the app to first launch."}
            </p>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                className="press mt-2.5 w-full rounded-xl border border-tomato/40 py-2.5 text-sm font-semibold text-tomato transition hover:bg-tomato/10"
              >
                {lang === "bn" ? "রিসেট করুন…" : "Reset all data…"}
              </button>
            ) : (
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="press rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-muted-foreground"
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
                <button
                  onClick={() => reset.mutate()}
                  disabled={reset.isPending}
                  className="press rounded-xl bg-tomato py-2.5 text-sm font-semibold text-white shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
                >
                  {reset.isPending
                    ? (lang === "bn" ? "মুছছি…" : "Deleting…")
                    : lang === "bn" ? "নিশ্চিত মুছুন" : "Yes, delete everything"}
                </button>
              </div>
            )}
          </section>
        </div>

        <button
          onClick={() => { onOpenChange(false); setConfirmReset(false); }}
          className="press mt-4 w-full rounded-xl bg-secondary py-2.5 text-sm font-semibold text-ink"
        >
          {lang === "bn" ? "বন্ধ করুন" : "Close"}
        </button>
      </div>
    </div>
  );
}
