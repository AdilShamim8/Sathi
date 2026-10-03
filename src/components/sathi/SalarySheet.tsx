"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Info } from "lucide-react";
import { api } from "./api";
import { Money } from "./bits";
import { useLang } from "./i18n";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/**
 * Salary settings sheet (user's explicit request).
 * Lets the user set their monthly salary and pay day. Recurring income
 * detection still runs on transaction history; these settings refine the
 * forecast when history is ambiguous.
 */
export function SalarySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = useQuery({ queryKey: ["salary"], queryFn: api.salary, enabled: open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-card p-5 pb-safe shadow-ios-lg sm:rounded-3xl">
        {/* grabber */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        {data ? (
          <SalaryForm
            key={`${data.salaryAmount ?? "x"}-${data.salaryPayDay ?? "x"}`}
            initialAmount={data.salaryAmount}
            initialPayDay={data.salaryPayDay}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <div className="space-y-3">
            <div className="h-6 w-40 animate-pulse rounded-lg bg-secondary" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-secondary" />
            <div className="h-12 w-full animate-pulse rounded-xl bg-secondary" />
          </div>
        )}
      </div>
    </div>
  );
}

function SalaryForm({
  initialAmount,
  initialPayDay,
  onDone,
}: {
  initialAmount: number | null;
  initialPayDay: number | null;
  onDone: () => void;
}) {
  const { lang } = useLang();
  const qc = useQueryClient();
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  const [payDay, setPayDay] = useState(initialPayDay ? String(initialPayDay) : "");

  const save = useMutation({
    mutationFn: () =>
      api.updateSalary({
        salaryAmount: amount.trim() === "" ? null : parseInt(amount, 10),
        salaryPayDay: payDay.trim() === "" ? null : parseInt(payDay, 10),
      }),
    onSuccess: async () => {
      toast({ title: lang === "bn" ? "বেতন সেটিংস সংরক্ষিত" : "Salary settings saved" });
      await qc.invalidateQueries({ queryKey: ["salary"] });
      await qc.invalidateQueries({ queryKey: ["summary"] });
      await qc.invalidateQueries({ queryKey: ["forecast"] });
      onDone();
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-leaf/15">
          <Wallet className="h-5 w-5 text-leafdark" />
        </span>
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {lang === "bn" ? "বেতন সেটিংস" : "Salary settings"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn" ? "ক্যাশ-ফ্লো পূর্বাভাস আরও নির্ভুল করুন" : "Sharpen your cash-flow forecast"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="salary-amount">
            {lang === "bn" ? "মাসিক বেতন (৳)" : "Monthly salary (৳)"}
          </label>
          <input
            id="salary-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="30000"
            className="nums mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-lg font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
          />
          {amount && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              ≈ <Money value={Math.round(parseInt(amount, 10) / 30)} /> / {lang === "bn" ? "দিন" : "day"}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor="salary-payday">
            {lang === "bn" ? "বেতনের দিন (মাসের কত তারিখে)" : "Pay day (day of month)"}
          </label>
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 5, 7, 10, 15].map((d) => (
              <button
                key={d}
                onClick={() => setPayDay(String(d))}
                className={cn(
                  "press nums rounded-xl border py-2 text-xs font-semibold transition",
                  payDay === String(d) ? "border-ink bg-ink text-background" : "border-border bg-background text-muted-foreground hover:border-ink/40",
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <input
            id="salary-payday"
            value={payDay}
            onChange={(e) => setPayDay(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder={lang === "bn" ? "অথবা লিখুন (১–৩১)" : "or type any day (1–31)"}
            className="nums mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {lang === "bn"
              ? "আমরা আপনার লেনদেন ইতিহাস থেকে আয়ের ধরন শিখি — এই সেটিংস শুধু অনুমান নির্ভুল করে। কোনো ব্যাংক সংযোগ নেই; সব ডেটা আপনার ডিভাইসে।"
              : "We learn income patterns from your transaction history — these settings only refine the estimate. No bank connections; all data stays on your device."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onDone}
          className="press flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-ink/30"
        >
          {lang === "bn" ? "বাতিল" : "Cancel"}
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="press flex-[2] rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          {save.isPending ? (lang === "bn" ? "সংরক্ষিত হচ্ছে…" : "Saving…") : (lang === "bn" ? "সংরক্ষণ করুন" : "Save settings")}
        </button>
      </div>
    </>
  );
}
