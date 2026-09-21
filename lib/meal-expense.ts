import { isMealExpenseRange } from "@/lib/recommendation-reasons";

const MAX_CENTS = 99_999_999;

export function centsFromCurrencyInput(text: string) {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  const stripped = digits.replace(/^0+/, "") || "0";
  const cents = Number.parseInt(stripped, 10);
  if (!Number.isFinite(cents) || cents < 0) return null;
  return Math.min(cents, MAX_CENTS);
}

export function amountFromCents(cents: number) {
  return cents / 100;
}

export function formatMealExpense(amount: number | null) {
  if (amount == null) return "";
  return amount.toFixed(2);
}

export function parseMealExpenseBaht(text: string) {
  const match = text.replace(/,/g, "").match(/\d+/);
  if (!match) return null;
  const amount = Number.parseInt(match[0] ?? "", 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export function isMealExpenseComplete(amount: number | null | undefined) {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}

export function isMealExpenseRangeComplete(
  range: string | null | undefined,
  amount?: number | null,
) {
  if (range === "฿2,000+") return isMealExpenseComplete(amount);
  return Boolean(range && isMealExpenseRange(range));
}
