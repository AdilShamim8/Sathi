"use client";
/**
 * Transaction sheet: structured form for manual add AND edit of an existing
 * transaction (amount, direction, category, merchant, date) with delete.
 * This is the reliable path for income sources (salary/freelance) and for
 * correcting entries — natural language stays available in the compose box.
 *
 * The parent mounts this sheet conditionally with a `key`, so every open is
 * a fresh mount: state initializes directly from `editing` (no effects).
 */
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";
import { api, type TxnRow, type ManualTxnInput } from "./api";
import { ALL_CATEGORIES, categoryLabel } from "@/lib/engine/domain";
import { useLang } from "./i18n";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const EXPENSE_CATEGORIES = ALL_CATEGORIES.filter((c) => c.id !== "income");

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toInputDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TxnSheet({
  editing,
  onClose,
}: {
  /** When set, the sheet edits this transaction; otherwise it creates. */
  editing?: TxnRow | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const qc = useQueryClient();

  const [direction, setDirection] = useState<"out" | "in">(editing?.direction ?? "out");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [category, setCategory] = useState(editing?.category ?? "food_beverage");
  const [merchant, setMerchant] = useState(editing?.merchant ?? "");
  const [date, setDate] = useState(editing ? toInputDate(editing.timestamp) : todayInput());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = useMemo(
    () => (direction === "in" ? ALL_CATEGORIES.filter((c) => c.id === "income") : EXPENSE_CATEGORIES),
    [direction],
  );

  const switchDirection = (d: "out" | "in") => {
    setDirection(d);
    // keep the category valid for the chosen direction (event-driven, no effect)
    if (d === "in") setCategory("income");
    else if (category === "income") setCategory("food_beverage");
  };

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["transactions"] });
    await qc.invalidateQueries({ queryKey: ["summary"] });
    await qc.invalidateQueries({ queryKey: ["spending"] });
    await qc.invalidateQueries({ queryKey: ["forecast"] });
    await qc.invalidateQueries({ queryKey: ["insights"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const amt = parseInt(amount, 10);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error(lang === "bn" ? "পরিমাণ লিখুন" : "Enter a valid amount");
      const body: ManualTxnInput = {
        amount: amt,
        direction,
        category,
        merchant: merchant.trim() || null,
        timestamp: new Date(`${date}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
      };
      if (editing) {
        return api.updateTransaction(editing.id, body);
      }
      return api.addManualTransaction(body);
    },
    onSuccess: async () => {
      await refresh();
      toast({
        title: editing
          ? (lang === "bn" ? "লেনদেন হালনাগাদ ✓" : "Transaction updated ✓")
          : (lang === "bn" ? "সংরক্ষিত ✓" : "Saved ✓"),
        description: `৳${parseInt(amount, 10).toLocaleString()} · ${categoryLabel(category, lang)}`,
      });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteTransaction(editing!.id),
    onSuccess: async () => {
      await refresh();
      toast({ title: lang === "bn" ? "মুছে ফেলা হয়েছে" : "Deleted", description: lang === "bn" ? "লেনদেনটি সরানো হয়েছে" : "The transaction was removed" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  const amountValid = parseInt(amount, 10) >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="thin-scrollbar relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 pb-safe shadow-ios-lg sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />

        <h3 className="text-base font-semibold tracking-tight">
          {editing
            ? (lang === "bn" ? "লেনদেন সম্পাদনা" : "Edit transaction")
            : (lang === "bn" ? "নতুন লেনদেন" : "New transaction")}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {lang === "bn" ? "আয় বা খরচ — সঠিকভাবে সম্পাদনা করা যায়" : "Income or expense — fully editable later"}
        </p>

        <div className="mt-4 space-y-3.5">
          {/* direction */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => switchDirection("out")}
              className={cn(
                "press flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition",
                direction === "out" ? "border-ink bg-ink text-background shadow-ios" : "border-border bg-background text-muted-foreground hover:border-ink/40",
              )}
            >
              <ArrowUpCircle className="h-4 w-4" />
              {lang === "bn" ? "খরচ" : "Expense"}
            </button>
            <button
              onClick={() => switchDirection("in")}
              className={cn(
                "press flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition",
                direction === "in" ? "border-leafdark bg-leaf/15 text-leafdark shadow-ios" : "border-border bg-background text-muted-foreground hover:border-ink/40",
              )}
            >
              <ArrowDownCircle className="h-4 w-4" />
              {lang === "bn" ? "আয়" : "Income"}
            </button>
          </div>

          {/* amount */}
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="txn-amount">
              {lang === "bn" ? "পরিমাণ (৳)" : "Amount (৳)"}
            </label>
            <input
              id="txn-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
              inputMode="numeric"
              placeholder="0"
              className="nums mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-lg font-semibold outline-none transition focus:border-leafdark focus:ring-2 focus:ring-leaf/20"
            />
          </div>

          {/* category */}
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="txn-category">
              {lang === "bn" ? "ক্যাটাগরি" : "Category"}
            </label>
            <select
              id="txn-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{categoryLabel(c.id, lang)}</option>
              ))}
            </select>
          </div>

          {/* merchant / description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="txn-merchant">
              {direction === "in"
                ? (lang === "bn" ? "উৎস (যেমন: Freelance, বেতন)" : "Source (e.g. Freelance, Salary)")
                : (lang === "bn" ? "বিবরণ / দোকান (ঐচ্ছিক)" : "Description / merchant (optional)")}
            </label>
            <input
              id="txn-merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value.slice(0, 120))}
              placeholder={direction === "in" ? (lang === "bn" ? "যেমন: Freelance প্রজেক্ট" : "e.g. Freelance project") : (lang === "bn" ? "যেমন: রিকশা, কামাল স্টোর" : "e.g. Rickshaw, Kamal Store")}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
            />
          </div>

          {/* date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="txn-date">
              {lang === "bn" ? "তারিখ" : "Date"}
            </label>
            <input
              id="txn-date"
              type="date"
              value={date}
              max={todayInput()}
              onChange={(e) => setDate(e.target.value)}
              className="nums mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-leafdark"
            />
          </div>
        </div>

        {/* actions */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="press flex-1 rounded-xl border border-border bg-background py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-ink/30"
          >
            {lang === "bn" ? "বাতিল" : "Cancel"}
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !amountValid}
            className="press flex-[2] rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-ios transition enabled:hover:opacity-90 disabled:opacity-40"
          >
            {save.isPending
              ? (lang === "bn" ? "সংরক্ষিত হচ্ছে…" : "Saving…")
              : editing
                ? (lang === "bn" ? "হালনাগাদ করুন" : "Save changes")
                : (lang === "bn" ? "সংরক্ষণ করুন" : "Save transaction")}
          </button>
        </div>

        {/* delete (edit mode only) */}
        {editing && (
          <div className="mt-3 border-t border-dashed border-border pt-3">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="press flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-tomato transition hover:bg-tomato/5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {lang === "bn" ? "লেনদেনটি মুছুন" : "Delete this transaction"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="flex-1 text-[12px] leading-snug text-muted-foreground">
                  {lang === "bn" ? "নিশ্চিত? এটি ফেরানো যাবে না।" : "Are you sure? This cannot be undone."}
                </p>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="press rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground"
                >
                  {lang === "bn" ? "না" : "No"}
                </button>
                <button
                  onClick={() => remove.mutate()}
                  disabled={remove.isPending}
                  className="press rounded-lg bg-tomato px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {remove.isPending ? "…" : (lang === "bn" ? "মুছুন" : "Delete")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
