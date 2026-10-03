/**
 * Rules-based transaction categorizer — ported from Sathi core/categorizer.py,
 * adapted to this app's Txn shape (category is pre-assigned by the keyword
 * classifier; this module maps to the Sathi 12-category taxonomy and adds a
 * reason trace for every result, as the reference does).
 *
 * No classifier is trained on these labels: on rule-generated synthetic data
 * a classifier would learn the rules themselves (reference ADR-11), which is
 * circular. This categorizer is deterministic and explains itself.
 */

import type { Txn } from "./domain";

export type SathiCategory =
  | "salary"
  | "remittance"
  | "transfer_in"
  | "rent"
  | "bills"
  | "mobile"
  | "family"
  | "food"
  | "transport"
  | "business"
  | "cash_out"
  | "other";

export interface CategoryResult {
  category: SathiCategory;
  ruleId: string; // which rule fired (reason trace)
  reasonBn: string;
  reasonEn: string;
}

const REASONS: Record<SathiCategory, [string, string]> = {
  salary: ["বেতন হিসেবে এসেছে", "Arrived as salary"],
  remittance: ["রেমিট্যান্স হিসেবে এসেছে", "Arrived as remittance"],
  transfer_in: ["ওয়ালেটে টাকা এসেছে", "Money received into the wallet"],
  rent: ["ভাড়ার কাউন্টারপার্টি", "Counterparty is tagged as rent"],
  bills: ["ইউটিলিটি বিল", "Utility bill payment"],
  mobile: ["মোবাইল রিচার্জ", "Mobile recharge"],
  family: ["পরিবারে টাকা পাঠানো", "Money sent to family"],
  food: ["খাবারের দোকান/মুদি মার্চেন্ট", "Food or grocery merchant"],
  transport: ["যাতায়াত খরচের মার্চেন্ট", "Transport merchant"],
  business: ["ব্যবসায়িক লেনদেন", "Business transaction"],
  cash_out: ["এজেন্ট থেকে ক্যাশ-আউট", "Cash withdrawal at an agent"],
  other: ["অন্য কোনো নিয়মে পড়েনি", "No other rule matched"],
};

/** Map this app's fine-grained category to the Sathi taxonomy, with the fired rule. */
export function categorize(txn: Txn): CategoryResult {
  let cat: SathiCategory;
  let rule: string;

  if (txn.direction === "in") {
    if (txn.category === "income") {
      const m = (txn.merchant ?? "").toLowerCase();
      if (/payroll|employer|salary|বেতন/.test(m)) {
        cat = "salary";
        rule = "in:merchant=salary";
      } else if (/remitt|hundi|বিদেশ/.test(m)) {
        cat = "remittance";
        rule = "in:merchant=remittance";
      } else {
        cat = "transfer_in";
        rule = "in:default_transfer";
      }
    } else if (txn.category === "savings") {
      cat = "transfer_in";
      rule = "in:savings_in";
    } else {
      cat = "transfer_in";
      rule = "in:default_transfer";
    }
  } else if (txn.category === "cash_out") {
    cat = "cash_out";
    rule = "out:cash_out";
  } else if (txn.category === "housing") {
    cat = "rent";
    rule = "out:category=housing";
  } else if (txn.category === "utilities") {
    cat = "bills";
    rule = "out:category=utilities";
  } else if (txn.category === "mobile_topup") {
    cat = "mobile";
    rule = "out:category=mobile_topup";
  } else if (txn.category === "send_money") {
    cat = "family";
    rule = "send_money:default_family";
  } else if (txn.category === "food_beverage" || txn.category === "groceries") {
    cat = "food";
    rule = `payment:category=${txn.category}`;
  } else if (txn.category === "transport") {
    cat = "transport";
    rule = "payment:category=transport";
  } else if (txn.category === "education") {
    cat = "other";
    rule = "payment:category=education";
  } else if (txn.channel === "agent") {
    cat = "cash_out";
    rule = "channel:agent";
  } else {
    cat = "other";
    rule = "fallback";
  }

  const [reasonBn, reasonEn] = REASONS[cat];
  return { category: cat, ruleId: rule, reasonBn, reasonEn };
}

/** Display labels for the Sathi taxonomy (categories.yaml). */
export const SATHI_CATEGORY_LABELS: Record<SathiCategory, { bn: string; en: string }> = {
  salary: { bn: "বেতন", en: "Salary" },
  remittance: { bn: "রেমিট্যান্স", en: "Remittance" },
  transfer_in: { bn: "ট্রান্সফার", en: "Transfer in" },
  rent: { bn: "ভাড়া", en: "Rent" },
  bills: { bn: "বিল", en: "Bills" },
  mobile: { bn: "মোবাইল", en: "Mobile" },
  family: { bn: "পরিবার", en: "Family" },
  food: { bn: "খাবার", en: "Food" },
  transport: { bn: "যাতায়াত", en: "Transport" },
  business: { bn: "ব্যবসা", en: "Business" },
  cash_out: { bn: "ক্যাশ-আউট", en: "Cash-out" },
  other: { bn: "অন্যান্য", en: "Other" },
};
