"use client";

import { COVER_TEMPLATE_OPTIONS } from "@/lib/cover/post-layout";
import { useLanguage } from "@/components/providers/language-provider";
import { cn } from "@/lib/utils";

export function TemplatePicker({
  selectedId,
  disabled,
  onSelect,
}: {
  selectedId: string;
  disabled?: boolean;
  onSelect: (templateId: string) => void;
}) {
  const { language, t } = useLanguage();

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t.result.templateLabel}</h2>
      <div className="flex flex-wrap gap-2">
        {COVER_TEMPLATE_OPTIONS.map((option) => {
          const selected = option.id === selectedId;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                selected
                  ? "border-primary bg-accent text-foreground shadow-sm ring-2 ring-primary/20"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30",
                disabled && "opacity-50",
              )}
            >
              {language === "zh" ? option.zh : option.en}
            </button>
          );
        })}
      </div>
    </section>
  );
}
