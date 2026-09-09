"use client";

import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/components/providers/language-provider";
import { interpolate } from "@/lib/i18n";

export function CaptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useT();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-base font-semibold">{t.result.caption}</h2>
        <span className="text-xs text-muted-foreground">
          {interpolate(t.result.characters, { count: value.length })}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-48 leading-relaxed"
        placeholder={t.result.captionPlaceholder}
      />
    </section>
  );
}
