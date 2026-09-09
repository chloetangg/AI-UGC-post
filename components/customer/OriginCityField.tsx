"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { menuOptionClass, menuPanelClass, menuTriggerClass } from "@/components/ui/menu-select";
import {
  countryDisplayName,
  filterOriginCountries,
  findOriginCountry,
  originCountryValue,
  type CountryCallingCode,
} from "@/lib/country-calling-codes";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

export function OriginCityField({
  value,
  invalid,
  placeholder,
  searchPlaceholder,
  noMatches,
  onChange,
}: {
  value: string;
  invalid?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  noMatches: string;
  onChange: (value: string) => void;
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = findOriginCountry(value);
  const groups = useMemo(() => filterOriginCountries(query), [query]);
  const hasOptions = groups.pinned.length + groups.rest.length > 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const node = rootRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function selectCountry(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function renderCountry(item: CountryCallingCode) {
    const next = originCountryValue(item);
    const active = selected ? originCountryValue(selected) === next : false;
    return (
      <li key={item.iso2}>
        <button
          type="button"
          role="option"
          aria-selected={active}
          className={menuOptionClass(active)}
          onClick={() => selectCountry(next)}
        >
          {countryDisplayName(item, language)}
        </button>
      </li>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id="location"
        aria-label="Origin country"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid}
        className={cn(
          menuTriggerClass,
          "w-full px-4",
          invalid ? "border-destructive ring-2 ring-destructive/15" : "",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("min-w-0 flex-1 truncate text-left", selected ? "text-foreground" : "text-muted-foreground/80")}>
          {selected ? countryDisplayName(selected, language) : placeholder}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", open && "rotate-180")} />
      </button>

      {open ? (
        <div className={menuPanelClass}>
          <div className="border-b border-border p-2">
            <Input
              ref={searchRef}
              value={query}
              placeholder={searchPlaceholder}
              className="h-10"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
            />
          </div>
          <ul role="listbox" className="max-h-[min(16rem,50vh)] overflow-y-auto py-1">
            {!hasOptions ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">{noMatches}</li>
            ) : (
              <>
                {groups.pinned.map(renderCountry)}
                {groups.showDivider ? (
                  <li role="separator" className="my-1.5 border-t border-border" />
                ) : null}
                {groups.rest.map(renderCountry)}
              </>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
