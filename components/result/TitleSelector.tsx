"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";
import { Input } from "@/components/ui/input";

export function TitleSelector({
  titles,
  selectedIndex,
  onSelect,
  onChangeTitle,
}: {
  titles: string[];
  selectedIndex: number;
  onSelect: (index: 0 | 1 | 2) => void;
  onChangeTitle: (index: 0 | 1 | 2, value: string) => void;
}) {
  const t = useT();
  const selectedTitle = titles[selectedIndex] ?? "";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-base font-semibold">{t.result.titleLabel}</h2>
        <span className="text-xs text-muted-foreground">
          {interpolate(t.result.characters, { count: selectedTitle.length })}
        </span>
      </div>
      <div className="space-y-2.5">
        {titles.map((title, index) => {
          const selected = selectedIndex === index;
          return (
            <div
              key={index}
              className={cn(
                "rounded-2xl border px-3 py-2 transition-all",
                selected
                  ? "border-primary bg-accent shadow-sm ring-2 ring-primary/20"
                  : "border-border bg-card hover:border-primary/30",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(index as 0 | 1 | 2)}
                className="mb-1.5 flex w-full items-center justify-between"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {interpolate(t.result.option, { index: index + 1 })}
                </span>
                {selected ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
              <Input
                value={title}
                onFocus={() => onSelect(index as 0 | 1 | 2)}
                onChange={(event) => onChangeTitle(index as 0 | 1 | 2, event.target.value)}
                className="h-11 px-3 text-[15px]"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
