"use client";

import { useLayoutEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import {
  amountFromCents,
  centsFromCurrencyInput,
  formatMealExpense,
} from "@/lib/meal-expense";
import { cn } from "@/lib/utils";

export function MealExpenseField({
  value,
  currency,
  placeholder,
  invalid,
  onChange,
}: {
  value: number | null;
  currency: string;
  placeholder: string;
  invalid?: boolean;
  onChange: (amount: number | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = formatMealExpense(value);

  useLayoutEffect(() => {
    const node = inputRef.current;
    if (!node || document.activeElement !== node) return;
    const end = node.value.length;
    node.setSelectionRange(end, end);
  }, [display]);

  return (
    <div
      className={cn(
        "flex h-12 w-full items-center rounded-2xl border border-border bg-card px-4 shadow-sm",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        invalid ? "border-destructive ring-2 ring-destructive/15" : "",
      )}
    >
      <span className="shrink-0 pr-2 text-sm font-medium text-muted-foreground">{currency}</span>
      <Input
        ref={inputRef}
        id="totalMealExpense"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={invalid}
        value={display}
        className="h-auto rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0"
        onChange={(event) => {
          const cents = centsFromCurrencyInput(event.target.value);
          onChange(cents == null ? null : amountFromCents(cents));
        }}
        onKeyDown={(event) => {
          if (event.key === "." || event.key === "," || event.key === "e" || event.key === "E" || event.key === "+" || event.key === "-") {
            event.preventDefault();
          }
        }}
      />
    </div>
  );
}
