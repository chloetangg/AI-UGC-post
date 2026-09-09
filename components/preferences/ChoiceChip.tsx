"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/60",
      )}
    >
      {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      {label}
    </button>
  );
}
