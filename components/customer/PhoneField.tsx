"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { menuOptionClass, menuPanelClass, menuTriggerClass } from "@/components/ui/menu-select";
import {
  findCountryByIso2,
  filterCountries,
  countryDisplayName,
  type CountryCallingCode,
} from "@/lib/country-calling-codes";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

export function PhoneField({
  countryIso2,
  countryCode,
  phoneNumber,
  invalid,
  searchPlaceholder,
  numberPlaceholder,
  onCountryChange,
  onPhoneNumberChange,
}: {
  countryIso2: string;
  countryCode: string;
  phoneNumber: string;
  invalid?: boolean;
  searchPlaceholder: string;
  numberPlaceholder: string;
  onCountryChange: (country: CountryCallingCode) => void;
  onPhoneNumberChange: (value: string) => void;
}) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = findCountryByIso2(countryIso2, countryCode);
  const countries = useMemo(() => filterCountries(query), [query]);

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

  function selectCountry(country: CountryCallingCode) {
    onCountryChange(country);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative flex gap-2">
      <button
        type="button"
        id="countryCode"
        aria-label="Country calling code"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid}
        className={cn(
          menuTriggerClass,
          "w-[6.25rem] shrink-0 px-3",
          invalid ? "border-destructive ring-2 ring-destructive/15" : "",
        )}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{selected.dial}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground", open && "rotate-180")} />
      </button>

      <Input
        id="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder={numberPlaceholder}
        value={phoneNumber}
        aria-invalid={invalid}
        className="flex-1"
        onChange={(event) => onPhoneNumberChange(event.target.value)}
      />

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
            {countries.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">{t.customer.phoneNoMatches}</li>
            ) : (
              countries.map((country) => {
                const active = country.iso2 === selected.iso2 && country.dial === selected.dial;
                return (
                  <li key={`${country.iso2}-${country.dial}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={menuOptionClass(active)}
                      onClick={() => selectCountry(country)}
                    >
                      <span className="min-w-0 flex-1 truncate">{countryDisplayName(country, language)}</span>
                      <span className="shrink-0 text-muted-foreground">{country.dial}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
