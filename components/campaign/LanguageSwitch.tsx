"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em]"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={cn(
          "px-1 py-1 transition-colors",
          language === "en" ? "text-primary" : "text-muted-foreground",
        )}
        aria-pressed={language === "en"}
      >
        {t.language.en}
      </button>
      <span className="text-border" aria-hidden>
        |
      </span>
      <button
        type="button"
        onClick={() => setLanguage("zh")}
        className={cn(
          "px-1 py-1 transition-colors",
          language === "zh" ? "text-primary" : "text-muted-foreground",
        )}
        aria-pressed={language === "zh"}
      >
        {t.language.zh}
      </button>
    </div>
  );
}
