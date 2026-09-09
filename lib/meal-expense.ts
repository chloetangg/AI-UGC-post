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

export function isMealExpenseComplete(amount: number | null | undefined) {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}
