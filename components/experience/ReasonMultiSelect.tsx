"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { menuPanelClass, menuTriggerClass } from "@/components/ui/menu-select";
import { useLanguage } from "@/components/providers/language-provider";
import { recommendationReasonLabel } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { RecommendedDish } from "@/types/content";

export type ReasonOption = {
  value: string;
  label: string;
};

export type ReasonGroup = {
  id: string;
  label: string;
  options: readonly ReasonOption[];
};

export function ReasonMultiSelect({
  groups,
  selected,
  placeholder,
  emptyLabel,
  disabled,
  onChange,
}: {
  groups: ReasonGroup[];
  selected: string[];
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  onChange: (next: string[]) => void;
}) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selected);
  const hasOptions = groups.some((group) => group.options.length > 0);

  function labelFor(value: string) {
    return recommendationReasonLabel(t, value);
  }

  function groupLabel(group: ReasonGroup) {
    return t.options.recommendedDishes[group.id as RecommendedDish] ?? group.label;
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const node = rootRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(option: string) {
    onChange(
      selectedSet.has(option) ? selected.filter((item) => item !== option) : [...selected, option],
    );
  }

  const summary =
    selected.length > 0
      ? selected
          .map((value) => labelFor(value))
          .join(language === "zh" ? "、" : ", ")
      : placeholder;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled || !hasOptions}
        className={cn(menuTriggerClass, "h-auto min-h-12 w-full px-4 py-3")}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={cn(
            "min-w-0 flex-1 whitespace-normal break-words text-left",
            selected.length > 0 ? "text-foreground" : "text-muted-foreground/80",
          )}
        >
          {hasOptions ? summary : emptyLabel}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", open && "rotate-180")} />
      </button>
      {open && hasOptions ? (
        <div className={cn(menuPanelClass, "max-h-[min(18rem,50vh)] overflow-y-auto")}>
          {groups.map((group) =>
            group.options.length === 0 ? null : (
              <div key={group.id} className="py-1">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground">
                  {groupLabel(group)}
                </p>
                <ul role="listbox" aria-multiselectable="true">
                  {group.options.map((option) => {
                    const active = selectedSet.has(option.value);
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm",
                            active ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/70",
                          )}
                          onClick={() => toggle(option.value)}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                            )}
                          >
                            {active ? <Check className="size-3" strokeWidth={3} /> : null}
                          </span>
                          <span className="min-w-0 flex-1 whitespace-normal break-words">{labelFor(option.value)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
