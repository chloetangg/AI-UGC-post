"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { UI_LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold tracking-[0.06em]"
      role="group"
      aria-label="Language"
    >
      {UI_LANGUAGES.map((code, index) => (
        <span key={code} className="flex items-center">
          {index > 0 ? (
            <span className="px-0.5 text-border" aria-hidden>
              |
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setLanguage(code)}
            className={cn(
              "px-1 py-1 transition-colors",
              language === code ? "text-primary" : "text-muted-foreground",
            )}
            aria-pressed={language === code}
          >
            {t.language[code]}
          </button>
        </span>
      ))}
    </div>
  );
}
