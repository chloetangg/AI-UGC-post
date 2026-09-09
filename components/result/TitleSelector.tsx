"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";

export function TitleSelector({
  titles,
  selectedIndex,
  onSelect,
}: {
  titles: string[];
  selectedIndex: number;
  onSelect: (index: 0 | 1 | 2) => void;
}) {
  const t = useT();

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t.result.titleLabel}</h2>
      <div className="space-y-2.5">
        {titles.map((title, index) => {
          const selected = selectedIndex === index;
          return (
            <button
              key={title}
              type="button"
              onClick={() => onSelect(index as 0 | 1 | 2)}
              className={cn(
                "w-full rounded-2xl border px-4 py-3.5 text-left transition-all",
                selected
                  ? "border-primary bg-accent shadow-sm ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/30",
              )}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {interpolate(t.result.option, { index: index + 1 })}
                </span>
                {selected ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </div>
              <p className="text-[15px] leading-relaxed font-medium">{title}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
