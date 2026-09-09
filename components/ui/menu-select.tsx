"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuSelectOption = {
  value: string;
  label: string;
};

export const menuTriggerClass = cn(
  "flex h-12 items-center justify-between gap-1 rounded-2xl border border-border bg-card text-base text-foreground shadow-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20",
);

export const menuPanelClass =
  "absolute top-[calc(100%+0.35rem)] right-0 left-0 z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

export function menuOptionClass(active: boolean) {
  return cn(
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
    active ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/70",
  );
}

export function MenuSelect({
  id,
  value,
  placeholder,
  options,
  invalid,
  disabled,
  "aria-label": ariaLabel,
  onChange,
}: {
  id?: string;
  value: string;
  placeholder: string;
  options: readonly MenuSelectOption[] | MenuSelectOption[];
  invalid?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

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

  function select(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid}
        disabled={disabled}
        className={cn(
          menuTriggerClass,
          "w-full px-4",
          invalid ? "border-destructive ring-2 ring-destructive/15" : "",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("truncate text-left", selected ? "text-foreground" : "text-muted-foreground/80")}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", open && "rotate-180")} />
      </button>

      {open ? (
        <div className={menuPanelClass}>
          <ul role="listbox" className="max-h-[min(16rem,50vh)] overflow-y-auto py-1">
            {options.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={menuOptionClass(active)}
                    onClick={() => select(option.value)}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
